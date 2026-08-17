#!/usr/bin/env node
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFileSync } from "node:fs";

const args = parseArgs(process.argv.slice(2));

if (args.help || (!args.native && !args.relay && !args["permission-relay"] && !args["model-native"] && !args["model-relay"])) {
  printUsage();
  process.exit(args.help ? 0 : 1);
}

const report = {
  generatedAt: new Date().toISOString(),
  checks: [],
};

if (args.native || args.relay) {
  if (!args.native || !args.relay) failUsage("Both --native and --relay are required for request parity comparison.");
  const nativeTurns = businessTurns(readFrames(args.native));
  const relayTurns = businessTurns(readFrames(args.relay));
  compareCase(report, "text", firstTurn(nativeTurns, turn => turn.imageCount === 0), firstTurn(relayTurns, turn => turn.imageCount === 0));
  compareCase(report, "image", firstTurn(nativeTurns, turn => turn.imageCount > 0), firstTurn(relayTurns, turn => turn.imageCount > 0));

  if (args["native-rollout"] || args["relay-rollout"]) {
    if (!args["native-rollout"] || !args["relay-rollout"]) {
      failUsage("Both --native-rollout and --relay-rollout are required for AGENTS.md comparison.");
    }
    compareRolloutAgents(report, args["native-rollout"], args["relay-rollout"]);
  }
}

if (args["permission-relay"]) {
  validateFailedPermissionSwitch(report, args["permission-relay"], args["permission-marker"] ?? "AFTER_FAILED_READ_ONLY");
}

if (args["model-native"] || args["model-relay"]) {
  if (!args["model-native"] || !args["model-relay"]) {
    failUsage("Both --model-native and --model-relay are required for model/effort parity comparison.");
  }
  compareModelEffortTrace(report, args["model-native"], args["model-relay"]);
}

printReport(report, args.json);
if (report.checks.some(check => check.status !== "PASS")) process.exitCode = 1;

function readFrames(path) {
  const frames = [];
  for (const [index, line] of readFileSync(path, "utf8").split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      frames.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`Unable to parse ${path}:${index + 1}: ${error.message}`);
    }
  }
  return frames;
}

function businessTurns(frames) {
  return frames
    .map((frame, index) => ({ frame, index: index + 1 }))
    .filter(({ frame }) => frame.direction === "desktop_to_appserver" && frame.json?.method === "turn/start")
    .map(({ frame, index }) => normalizeTurnStart(frame.json, index))
    .filter(turn => !turn.isAuxiliary);
}

function modelEffortEvents(frames) {
  return frames
    .map((frame, index) => ({ frame, index: index + 1 }))
    .flatMap(({ frame, index }) => {
      const message = frame.json;
      if (frame.direction === "desktop_to_appserver" && message?.method === "thread/settings/update") {
        const params = message.params ?? {};
        return [{
          kind: "settings-update",
          line: index,
          threadId: params.threadId,
          model: params.model ?? null,
          effort: params.effort ?? null,
          multiAgentMode: params.multiAgentMode ?? null,
        }];
      }
      if (frame.direction === "appserver_to_desktop" && message?.method === "thread/settings/updated") {
        const params = message.params ?? {};
        const settings = params.threadSettings ?? {};
        return [{
          kind: "settings-updated",
          line: index,
          threadId: params.threadId,
          model: settings.model ?? null,
          effort: settings.effort ?? null,
          serviceTier: settings.serviceTier ?? null,
          approvalPolicy: settings.approvalPolicy ?? null,
          approvalsReviewer: settings.approvalsReviewer ?? null,
          sandboxPolicy: settings.sandboxPolicy?.type ?? null,
          activePermissionProfile: settings.activePermissionProfile?.id ?? null,
          collaborationModel: settings.collaborationMode?.settings?.model ?? null,
          collaborationEffort: settings.collaborationMode?.settings?.reasoning_effort ?? null,
          multiAgentMode: settings.multiAgentMode ?? null,
        }];
      }
      if (frame.direction === "desktop_to_appserver" && message?.method === "turn/start") {
        const turn = normalizeTurnStart(message, index);
        if (turn.isAuxiliary) return [];
        return [{
          kind: "turn-start",
          line: index,
          threadId: turn.threadId,
          requestText: turn.requestText,
          topModel: message.params?.model ?? null,
          topEffort: message.params?.effort ?? null,
          serviceTier: message.params?.serviceTier ?? null,
          collaborationModel: turn.model,
          collaborationEffort: turn.effort,
          multiAgentMode: turn.multiAgentMode,
        }];
      }
      return [];
    });
}

function normalizeTurnStart(message, line) {
  const params = message.params ?? {};
  const input = params.input ?? [];
  const textBlocks = input.filter(block => block.type === "text").map(block => block.text ?? "");
  const text = textBlocks.join("\n");
  const localImages = input.filter(block => block.type === "localImage");
  const requestText = extractRequestText(text);
  const fileMentions = extractFileMentions(text);
  const attachments = params.attachments ?? [];
  return {
    line,
    idType: typeof message.id,
    threadId: params.threadId,
    requestText,
    imageCount: localImages.length,
    input: {
      types: input.map(block => block.type),
      textShape: textShape(text),
      fileMentionCount: fileMentions.length,
      fileMentionBasenames: fileMentions.map(file => basename(file.path)),
      localImageBasenames: localImages.map(image => basename(image.path ?? "")),
    },
    attachments: {
      count: attachments.length,
      labels: attachments.map(attachment => attachment.label ?? null),
      pathBasenames: attachments.map(attachment => basename(attachment.path ?? "")),
      fsPathBasenames: attachments.map(attachment => basename(attachment.fsPath ?? "")),
    },
    cwd: params.cwd,
    approvalPolicy: params.approvalPolicy,
    approvalsReviewer: params.approvalsReviewer,
    permissionShape: permissionShape(params),
    model: params.collaborationMode?.settings?.model ?? params.model ?? null,
    effort: params.collaborationMode?.settings?.reasoning_effort ?? params.effort ?? null,
    serviceTier: params.serviceTier ?? null,
    summary: params.summary ?? null,
    personality: params.personality ?? null,
    multiAgentMode: params.multiAgentMode ?? null,
    outputSchema: params.outputSchema ?? null,
    isAuxiliary: isAuxiliaryTurn(text, params),
  };
}

function textShape(text) {
  if (text.includes("# Files mentioned by the user:") && text.includes("## My request:")) return "files-mentioned-wrapper";
  return "plain";
}

function extractRequestText(text) {
  const marker = "## My request:";
  const markerIndex = text.indexOf(marker);
  if (markerIndex >= 0) return text.slice(markerIndex + marker.length).trim();
  return text.trim();
}

function extractFileMentions(text) {
  const mentions = [];
  const pattern = /^##\s+(.+?):\s+(.+)$/gm;
  for (const match of text.matchAll(pattern)) {
    mentions.push({ label: match[1], path: match[2] });
  }
  return mentions;
}

function isAuxiliaryTurn(text, params) {
  if (text.includes("Generate the session title")) return true;
  if (text.includes("You will be presented with a user prompt") && text.includes("short title")) return true;
  return params.approvalPolicy === "never" && params.permissions === ":read-only" && params.cwd == null;
}

function permissionShape(params) {
  if (params.sandboxPolicy) {
    return {
      mode: "sandboxPolicy",
      type: params.sandboxPolicy.type,
      writableRootKinds: (params.sandboxPolicy.writableRoots ?? []).map(root => rootKind(root, params.cwd)),
      networkAccess: params.sandboxPolicy.networkAccess ?? null,
      excludeTmpdirEnvVar: params.sandboxPolicy.excludeTmpdirEnvVar ?? null,
      excludeSlashTmp: params.sandboxPolicy.excludeSlashTmp ?? null,
      permissions: params.permissions ?? null,
      runtimeWorkspaceRootKinds: params.runtimeWorkspaceRoots ?? null,
    };
  }
  return {
    mode: "permissionProfile",
    type: params.permissions ?? null,
    writableRootKinds: null,
    networkAccess: null,
    excludeTmpdirEnvVar: null,
    excludeSlashTmp: null,
    permissions: params.permissions ?? null,
    runtimeWorkspaceRootKinds: Array.isArray(params.runtimeWorkspaceRoots)
      ? params.runtimeWorkspaceRoots.map(root => rootKind(root, params.cwd))
      : params.runtimeWorkspaceRoots ?? null,
  };
}

function rootKind(root, cwd) {
  if (root === cwd) return "cwd";
  if (typeof root === "string" && root.includes("/visualizations/")) return "visualization";
  if (root === "/tmp" || root === "/private/tmp") return "slash-tmp";
  if (typeof root === "string" && root.includes("/var/folders/")) return "tmpdir";
  return "other";
}

function firstTurn(turns, predicate) {
  return turns.find(predicate) ?? null;
}

function compareCase(report, name, nativeTurn, relayTurn) {
  const check = { name: `turn-start:${name}`, status: "PASS", details: {}, differences: [] };
  if (!nativeTurn || !relayTurn) {
    check.status = "FAIL";
    check.differences.push({
      path: name,
      native: nativeTurn ? "present" : "missing",
      relay: relayTurn ? "present" : "missing",
    });
    report.checks.push(check);
    return;
  }

  const nativeComparable = comparableTurn(nativeTurn);
  const relayComparable = comparableTurn(relayTurn);
  check.details = {
    nativeLine: nativeTurn.line,
    relayLine: relayTurn.line,
    requestText: nativeComparable.requestText,
    imageCount: nativeComparable.imageCount,
  };
  check.differences = diffValues(nativeComparable, relayComparable);
  check.status = check.differences.length === 0 ? "PASS" : "FAIL";
  report.checks.push(check);
}

function comparableTurn(turn) {
  return {
    requestText: turn.requestText,
    imageCount: turn.imageCount,
    input: turn.input,
    attachments: turn.attachments,
    cwd: turn.cwd,
    approvalPolicy: turn.approvalPolicy,
    approvalsReviewer: turn.approvalsReviewer,
    permissionShape: turn.permissionShape,
    model: turn.model,
    effort: turn.effort,
    serviceTier: turn.serviceTier,
    summary: turn.summary,
    personality: turn.personality,
    multiAgentMode: turn.multiAgentMode,
    outputSchema: turn.outputSchema,
  };
}

function compareRolloutAgents(report, nativePath, relayPath) {
  const nativeAgents = rolloutAgents(nativePath);
  const relayAgents = rolloutAgents(relayPath);
  const check = {
    name: "rollout:agents-md",
    status: "PASS",
    details: {
      native: nativeAgents,
      relay: relayAgents,
    },
    differences: diffValues(nativeAgents, relayAgents),
  };
  check.status = check.differences.length === 0 ? "PASS" : "FAIL";
  report.checks.push(check);
}

function rolloutAgents(path) {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    const agents = item.type === "world_state" ? item.payload?.state?.agents_md : null;
    if (!agents) continue;
    return {
      present: true,
      directory: agents.directory,
      textSha256: sha256(agents.text ?? ""),
      firstLine: String(agents.text ?? "").split("\n")[0] ?? "",
    };
  }
  return { present: false, directory: null, textSha256: null, firstLine: null };
}

function validateFailedPermissionSwitch(report, path, marker) {
  const turns = businessTurns(readFrames(path));
  const turn = [...turns].reverse().find(candidate => candidate.requestText.includes(marker)) ?? turns.at(-1) ?? null;
  const check = {
    name: "permission:failed-switch-preserves-effective-workspace-write",
    status: "PASS",
    details: turn ? {
      line: turn.line,
      requestText: turn.requestText,
      permissionShape: turn.permissionShape,
      approvalPolicy: turn.approvalPolicy,
    } : {},
    differences: [],
  };
  if (!turn) {
    check.status = "FAIL";
    check.differences.push({ path: "turn", native: "expected permission validation turn", relay: "missing" });
  } else {
    const expected = {
      approvalPolicy: "on-request",
      permissionShape: {
        mode: "sandboxPolicy",
        type: "workspaceWrite",
        writableRootKinds: ["cwd", "visualization"],
        networkAccess: false,
        excludeTmpdirEnvVar: false,
        excludeSlashTmp: false,
        permissions: null,
        runtimeWorkspaceRootKinds: null,
      },
    };
    check.differences = diffValues(expected, {
      approvalPolicy: turn.approvalPolicy,
      permissionShape: turn.permissionShape,
    });
    check.status = check.differences.length === 0 ? "PASS" : "FAIL";
  }
  report.checks.push(check);
}

function compareModelEffortTrace(report, nativePath, relayPath) {
  const nativeEvents = modelEffortEvents(readFrames(nativePath));
  const relayEvents = modelEffortEvents(readFrames(relayPath));
  compareModelTurnSequence(report, nativeEvents, relayEvents);
  compareModelUpdateSequence(report, nativeEvents, relayEvents);
  validateModelTopLevelNull(report, "native", nativeEvents);
  validateModelTopLevelNull(report, "relay", relayEvents);
  validateSingleBusinessThread(report, "native", nativeEvents);
  validateSingleBusinessThread(report, "relay", relayEvents);
}

function compareModelTurnSequence(report, nativeEvents, relayEvents) {
  const nativeTurns = nativeEvents.filter(event => event.kind === "turn-start").map(modelTurnComparable);
  const relayTurns = relayEvents.filter(event => event.kind === "turn-start").map(modelTurnComparable);
  const check = {
    name: "model-effort:turn-start-sequence",
    status: "PASS",
    details: { nativeTurns, relayTurns },
    differences: diffValues(nativeTurns, relayTurns),
  };
  check.status = check.differences.length === 0 ? "PASS" : "FAIL";
  report.checks.push(check);
}

function modelTurnComparable(event) {
  return {
    requestText: event.requestText,
    collaborationModel: event.collaborationModel,
    collaborationEffort: event.collaborationEffort,
    topModel: event.topModel,
    topEffort: event.topEffort,
    serviceTier: event.serviceTier,
    multiAgentMode: event.multiAgentMode,
  };
}

function compareModelUpdateSequence(report, nativeEvents, relayEvents) {
  const nativeUpdates = effectivePreTurnSettingsUpdates(nativeEvents);
  const relayUpdates = effectivePreTurnSettingsUpdates(relayEvents);
  const check = {
    name: "model-effort:settings-update-sequence",
    status: "PASS",
    details: { nativeUpdates, relayUpdates },
    differences: diffValues(nativeUpdates, relayUpdates),
  };
  check.status = check.differences.length === 0 ? "PASS" : "FAIL";
  report.checks.push(check);
}

function effectivePreTurnSettingsUpdates(events) {
  const turns = events.filter(event => event.kind === "turn-start");
  return turns.slice(1).map((turn, index) => {
    const previousTurn = turns[index];
    const updates = events.filter(event =>
      event.kind === "settings-update"
      && event.threadId === turn.threadId
      && event.line > previousTurn.line
      && event.line < turn.line
    );
    const update = updates.at(-1) ?? null;
    return {
      requestText: turn.requestText,
      model: update?.model ?? null,
      effort: update?.effort ?? null,
      multiAgentMode: update?.multiAgentMode ?? null,
      updateCountBeforeTurn: updates.length,
      hasEffectiveUpdate: Boolean(update),
    };
  }).map(({ updateCountBeforeTurn, ...comparable }) => comparable);
}

function validateModelTopLevelNull(report, label, events) {
  const check = {
    name: `model-effort:${label}:turn-start-top-level-null`,
    status: "PASS",
    details: {},
    differences: [],
  };
  for (const event of events.filter(candidate => candidate.kind === "turn-start")) {
    if (event.topModel !== null || event.topEffort !== null || event.serviceTier !== null) {
      check.differences.push({
        path: `line ${event.line}`,
        native: { topModel: null, topEffort: null, serviceTier: null },
        relay: { topModel: event.topModel, topEffort: event.topEffort, serviceTier: event.serviceTier },
      });
    }
  }
  check.status = check.differences.length === 0 ? "PASS" : "FAIL";
  report.checks.push(check);
}

function validateSingleBusinessThread(report, label, events) {
  const threadIds = [...new Set(events.filter(event => event.kind === "turn-start").map(event => event.threadId))];
  const check = {
    name: `model-effort:${label}:single-business-thread`,
    status: threadIds.length === 1 ? "PASS" : "FAIL",
    details: { threadCount: threadIds.length },
    differences: threadIds.length === 1 ? [] : [{ path: "threadIds", native: "one business thread", relay: `${threadIds.length} business threads` }],
  };
  report.checks.push(check);
}

function diffValues(left, right, path = "") {
  if (Object.is(left, right)) return [];
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return [{ path, native: left, relay: right }];
    }
    return left.flatMap((item, index) => diffValues(item, right[index], `${path}[${index}]`));
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) return [{ path, native: left, relay: right }];
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    return keys.flatMap(key => diffValues(left[key], right[key], path ? `${path}.${key}` : key));
  }
  return [{ path, native: left, relay: right }];
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) failUsage(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === "json" || key === "help") {
      parsed[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) failUsage(`Missing value for ${arg}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function printReport(value, json) {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  for (const check of value.checks) {
    console.log(`${check.status} ${check.name}`);
    if (check.details?.nativeLine || check.details?.relayLine) {
      console.log(`  native line: ${check.details.nativeLine ?? "-"}, relay line: ${check.details.relayLine ?? "-"}`);
    }
    if (check.details?.requestText) console.log(`  request: ${check.details.requestText}`);
    if (check.details?.imageCount !== undefined) console.log(`  images: ${check.details.imageCount}`);
    if (check.details?.permissionShape) console.log(`  permission: ${JSON.stringify(check.details.permissionShape)}`);
    if (check.details?.nativeTurns) console.log(`  native turns: ${JSON.stringify(check.details.nativeTurns)}`);
    if (check.details?.relayTurns) console.log(`  relay turns:  ${JSON.stringify(check.details.relayTurns)}`);
    if (check.details?.nativeUpdates) console.log(`  native updates: ${JSON.stringify(check.details.nativeUpdates)}`);
    if (check.details?.relayUpdates) console.log(`  relay updates:  ${JSON.stringify(check.details.relayUpdates)}`);
    if (check.details?.threadCount !== undefined) console.log(`  thread count: ${check.details.threadCount}`);
    for (const difference of check.differences) {
      console.log(`  diff ${difference.path || "<root>"}`);
      console.log(`    native/expected: ${JSON.stringify(difference.native)}`);
      console.log(`    relay/actual:    ${JSON.stringify(difference.relay)}`);
    }
  }
}

function printUsage() {
  console.log(`Usage:
  node scripts/compare-codex-parity-trace.mjs \\
    --native <native.frames.jsonl> \\
    --relay <relay.frames.jsonl> \\
    [--native-rollout <native-rollout.jsonl> --relay-rollout <relay-rollout.jsonl>] \\
    [--permission-relay <relay-permission.frames.jsonl>] \\
    [--model-native <native-model.frames.jsonl> --model-relay <relay-model.frames.jsonl>] \\
    [--permission-marker <text>] [--json]

The comparison intentionally ignores dynamic ids and timestamps, and compares the
turn/start request shape for text input, image input, permissions, model/effort,
cwd, summary, and collaboration settings.`);
}

function failUsage(message) {
  console.error(message);
  printUsage();
  process.exit(1);
}
