import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CODEX_APP_DYNAMIC_TOOLS = [
  {
    type: "namespace",
    name: "codex_app",
    description: "Tools provided by the Codex app.",
    tools: [
      {
        type: "function",
        name: "load_workspace_dependencies",
        description: "Locate the configured bundled workspace dependency runtime paths for this local desktop thread, including Node.js, Python, and useful libraries for working with spreadsheets, slide decks, Word documents, and PDFs. This is read-only and takes no arguments.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
    ],
  },
];

export const CODEX_DYNAMIC_TOOLS = [
  ...CODEX_APP_DYNAMIC_TOOLS,
  {
    type: "function",
    name: "relay_wait_for_event",
    description: "Pause this DSH Session until Relay receives a matching external event.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["event_type", "description"],
      properties: {
        event_type: { type: "string", minLength: 1, description: "Stable external event type to match." },
        description: { type: "string", minLength: 1, description: "What work should continue after the event." },
      },
    },
  },
  {
    type: "function",
    name: "relay_cancel_waits",
    description: "Cancel active Relay waits owned by this DSH Session.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
];

export async function handleCodexServerRequest(ctx, { adapter, relayRuntime, runtime, request }) {
  const threadId = request.params?.threadId;
  const sessionId = threadId ? adapter.dshSessionForThread(threadId) : null;
  const agent = sessionId ? ctx.agents.get(sessionId) : null;
  if (!agent) {
    runtime.rejectRequest(request.id, new Error("Codex request has no owning live DSH Session"));
    return;
  }

  try {
    if (request.method === "item/tool/call" || request.method === "item/dynamicTool/call") {
      await handleDynamicTool(relayRuntime, runtime, request, agent);
      return;
    }
    if (isApproval(request.method)) {
      const outcome = await ctx.approval.request({
        agent,
        toolName: approvalToolName(request),
        reason: approvalReason(request),
      });
      await runtime.resolveRequest(request.id, {
        action: outcome === "allowed-once" ? "accept" : "decline",
      });
      return;
    }
    if (request.method === "item/tool/requestUserInput") {
      const questions = normalizeQuestions(request.params?.questions ?? []);
      const answer = await ctx.userQuestions.ask({ agent, questions });
      await runtime.resolveRequest(request.id, { answers: normalizeAnswers(answer) });
      return;
    }
    runtime.rejectRequest(request.id, new Error(`Unsupported Codex interaction ${request.method}`));
  } catch (error) {
    runtime.rejectRequest(request.id, error);
  }
}

async function handleDynamicTool(relayRuntime, runtime, request, agent) {
  const { namespace, name: tool } = requestedTool(request.params);
  const args = plainObject(request.params.arguments);
  if ((namespace === "codex_app" || !namespace) && tool === "load_workspace_dependencies") {
    runtime.respondDynamicTool(request.id, true, workspaceDependenciesText());
    return;
  }
  if (namespace === "codex_app") {
    runtime.respondDynamicTool(request.id, false, `Unsupported Codex app tool ${tool}.`);
    return;
  }
  if (tool === "relay_wait_for_event") {
    const eventType = requiredString(args.event_type, "event_type");
    const description = requiredString(args.description, "description");
    const waitId = `wait-${randomUUID()}`;
    await relayRuntime.registerWaits({
      sessionId: agent.id,
      taskSummary: description,
      context: { runtime: "dsh-codex", cwd: agent.session.header.cwd },
      waits: [{
        wait_id: waitId,
        phase: "external_event",
        exclusive: true,
        expected_event: eventType,
        caused_by: "Codex requested an external-event continuation.",
        actors: ["codex"],
        entities: [eventType],
        prior_exchange: description,
      }],
    });
    runtime.respondDynamicTool(request.id, true, `Waiting for ${eventType} (${waitId}).`);
    return;
  }
  if (tool === "relay_cancel_waits") {
    relayRuntime.cancelWaits(agent.id);
    runtime.respondDynamicTool(request.id, true, "Active Relay waits were cancelled.");
    return;
  }
  runtime.respondDynamicTool(request.id, false, `Unknown Relay tool ${tool}.`);
}

function requestedTool(params = {}) {
  const tool = params.tool;
  const namespace = typeof params.namespace === "string" ? params.namespace : null;
  if (typeof tool === "string") return splitToolName(namespace, tool);
  if (tool && typeof tool === "object") {
    return splitToolName(
      typeof tool.namespace === "string" ? tool.namespace : namespace,
      typeof tool.name === "string" ? tool.name : "",
    );
  }
  return splitToolName(namespace, typeof params.name === "string" ? params.name : "");
}

function splitToolName(namespace, name) {
  const match = /^([^.:]+)[.:](.+)$/.exec(name);
  if (match) return { namespace: namespace ?? match[1], name: match[2] };
  return { namespace, name };
}

function workspaceDependenciesText() {
  const root = primaryRuntimeRoot();
  const dependencies = join(root, "dependencies");
  const version = runtimeVersion(root);
  return [
    "Workspace dependencies are available for this local desktop thread.",
    "",
    "### Workspace Dependencies",
    "Use these bundled paths for sheets, slides, documents, PDFs, images, or browser automation:",
    `- Bundle version: \`${version}\``,
    `- Git executable: \`${join(dependencies, "bin/fallback/git")}\``,
    `- Node.js executable: \`${join(dependencies, "node/bin/node")}\``,
    `- Node.js packages: \`${join(dependencies, "node/node_modules")}\``,
    `- pnpm executable: \`${join(dependencies, "bin/fallback/pnpm")}\``,
    `- Python executable: \`${join(dependencies, "python/bin/python3")}\``,
    `- Python packages: \`${join(dependencies, "python")}\``,
    `- Override binaries: \`${join(dependencies, "bin/override")}\``,
    `- Fallback binaries: \`${join(dependencies, "bin/fallback")}\``,
  ].join("\n");
}

function primaryRuntimeRoot() {
  return process.env.CODEX_PRIMARY_RUNTIME_ROOT
    ?? join(homedir(), ".cache/codex-runtimes/codex-primary-runtime");
}

function runtimeVersion(root) {
  const manifest = join(root, "runtime.json");
  if (!existsSync(manifest)) return "unknown";
  try {
    const parsed = JSON.parse(readFileSync(manifest, "utf8"));
    return parsed.bundleVersion ?? "unknown";
  } catch {
    return "unknown";
  }
}

function isApproval(method) {
  return method === "item/commandExecution/requestApproval"
    || method === "item/fileChange/requestApproval"
    || method === "item/permissions/requestApproval"
    || method === "execCommandApproval"
    || method === "applyPatchApproval";
}

function approvalToolName(request) {
  if (request.method.includes("fileChange") || request.method === "applyPatchApproval") return "Codex file change";
  if (request.method.includes("permissions")) return "Codex permissions";
  return "Codex command";
}

function approvalReason(request) {
  const command = request.params?.command;
  if (typeof command === "string" && command.trim()) return command.trim();
  if (Array.isArray(command)) return command.join(" ");
  return request.params?.reason ?? "Codex requires permission to continue.";
}

function normalizeQuestions(input) {
  return input.slice(0, 3).map((question, index) => ({
    id: requiredString(question.id ?? `question-${index + 1}`, "question id"),
    header: String(question.header ?? "Codex").slice(0, 12),
    question: requiredString(question.question ?? question.prompt, "question"),
    options: Array.isArray(question.options)
      ? question.options.slice(0, 3).map(option => typeof option === "string"
        ? { label: option, description: option }
        : { label: String(option.label), description: String(option.description ?? option.label) })
      : [],
    multiSelect: Boolean(question.multiSelect),
  }));
}

function normalizeAnswers(answer) {
  if (!Array.isArray(answer?.answers)) return {};
  return Object.fromEntries(answer.answers.map((item) => [
    item.id,
    item.custom ? [...item.selected, item.custom] : item.selected,
  ]));
}

function plainObject(value) {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return plainObject(parsed);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}
