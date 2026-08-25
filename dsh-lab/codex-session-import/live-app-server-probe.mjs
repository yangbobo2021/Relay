import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CodexAppServerClient } from "../../integrations/codex/app-server-client.mjs";
import { CodexSessionRuntime } from "../../integrations/codex/session-runtime.mjs";

const ALL_SOURCES = ["cli", "vscode", "exec", "appServer", "unknown"];
const MARKER = "CSI-LIVE-CROSS-ENTRY-41B7";

async function main() {
  const root = await mkdtemp(join(tmpdir(), "relay-csi-live-"));
  const workspace = join(root, "workspace");
  const schemaRoot = join(root, "schemas");
  await mkdir(workspace, { recursive: true });

  const createdThreadIds = new Set();
  const observations = {};
  let primary;
  try {
    primary = new CodexAppServerClient({ command: "codex", requestTimeoutMs: 60_000 });
    await primary.start();

    const exactThreads = [];
    for (let index = 0; index < 3; index += 1) {
      const marker = `CSI-LIVE-EXACT-${index}`;
      const executed = await runCodexExec(workspace, marker);
      createdThreadIds.add(executed.threadId);
      const read = await primary.request("thread/read", { threadId: executed.threadId, includeTurns: true });
      exactThreads.push({ ...read.thread, marker });
    }

    const canonicalWorkspace = exactThreads[0].cwd;
    const pages = await listPages(primary, { cwd: canonicalWorkspace, sourceKinds: ALL_SOURCES, limit: 1 });
    const exactIds = pages.flatMap(page => page.data.map(candidate => candidate.id));
    const defaultSources = await primary.request("thread/list", { cwd: canonicalWorkspace, limit: 100 });
    assert.equal(new Set(exactIds).size, 3);
    assert.ok(exactThreads.every(thread => exactIds.includes(thread.id)));
    observations["CSI-001"] = {
      result: "pass",
      pages: pages.length,
      exactMatches: exactIds.length,
      normalizedCwdDiffersFromRequested: canonicalWorkspace !== workspace,
      execThreadsVisibleWithoutSourceKinds: exactThreads.filter(thread => defaultSources.data.some(candidate => candidate.id === thread.id)).length,
      requiredSourceKinds: ALL_SOURCES,
    };

    const beforeResume = await primary.request("thread/read", { threadId: exactThreads[0].id, includeTurns: true });
    const beforeUpdatedAt = beforeResume.thread.updatedAt;
    const resumed = await primary.request("thread/resume", { threadId: exactThreads[0].id, cwd: workspace });
    const afterResume = await primary.request("thread/read", { threadId: exactThreads[0].id, includeTurns: true });
    assert.equal(resumed.thread.id, exactThreads[0].id);
    assert.equal(afterResume.thread.updatedAt, beforeUpdatedAt);
    observations["CSI-007"] = {
      result: "pass",
      resumePreservedThreadId: true,
      resumeDidNotChangeUpdatedAt: true,
      missingCwdPolicyRequiresPluginValidation: true,
    };

    await primary.request("thread/archive", { threadId: exactThreads[1].id });
    const activeAfterArchive = await primary.request("thread/list", { cwd: canonicalWorkspace, sourceKinds: ALL_SOURCES, archived: false, limit: 100 });
    const archived = await primary.request("thread/list", { cwd: canonicalWorkspace, sourceKinds: ALL_SOURCES, archived: true, limit: 100 });
    assert.ok(!activeAfterArchive.data.some(candidate => candidate.id === exactThreads[1].id));
    assert.ok(archived.data.some(candidate => candidate.id === exactThreads[1].id));
    const unarchived = await primary.request("thread/unarchive", { threadId: exactThreads[1].id });
    assert.equal(unarchived.thread.id, exactThreads[1].id);
    observations["CSI-013"] = {
      result: "pass",
      archivedSeparatedFromActiveList: true,
      unarchiveRestoredSameThreadId: true,
      deleteCheckedDuringCleanup: true,
    };

    const cli = { threadId: exactThreads[2].id, marker: exactThreads[2].marker };
    const cliRead = await primary.request("thread/read", { threadId: cli.threadId, includeTurns: true });
    const cliSource = cliRead.thread.source?.kind ?? cliRead.thread.source ?? null;
    const listedExec = await primary.request("thread/list", { cwd: canonicalWorkspace, sourceKinds: ["exec"], limit: 100 });
    const listedCli = await primary.request("thread/list", { cwd: canonicalWorkspace, sourceKinds: ["cli"], limit: 100 });
    assert.equal(cliSource, "exec");
    assert.ok(listedExec.data.some(candidate => candidate.id === cli.threadId));
    assert.ok(!listedCli.data.some(candidate => candidate.id === cli.threadId));
    assert.ok(JSON.stringify(cliRead.thread.turns).includes(cli.marker));

    const runtime = new CodexSessionRuntime({ client: primary, cwd: canonicalWorkspace });
    const snapshot = await runtime.initialize();
    const defaultModel = snapshot.models.find(candidate => candidate.isDefault) ?? snapshot.models[0];
    assert.ok(defaultModel, "model/list returned no model");
    const runtimeResume = await runtime.resumeSession(cli.threadId, {
      cwd: canonicalWorkspace,
      model: defaultModel.id,
      effort: defaultModel.defaultReasoningEffort,
      sandbox: "read-only",
      approvalPolicy: "never",
    });
    const continuation = await runtime.sendAndWait(cli.threadId, {
      text: "What exact CSI marker did you output in the previous turn? Reply with only that marker.",
      sandbox: "read-only",
      approvalPolicy: "never",
    }, { timeoutMs: 180_000 });
    const continuationJson = JSON.stringify(continuation.items ?? []);
    const allTurns = runtime.getSession(cli.threadId)?.turns ?? [];
    const containsCompaction = JSON.stringify(allTurns).includes("contextCompaction");
    assert.equal(runtimeResume.id, cli.threadId);
    assert.ok(continuationJson.includes(cli.marker));
    observations["CSI-002"] = {
      result: "pass",
      origin: cliSource,
      discoveredWithExecSource: true,
      resumedSameThread: true,
      historicalMarkerReadable: true,
      continuationRecoveredMarker: true,
      contextCompactionPresent: containsCompaction,
      dshInspectedCompactionPayload: false,
    };
    await runtime.close();
    primary = null;

    observations["CSI-003"] = await profileIsolationProbe(root);
    observations["CSI-006"] = await concurrentTurnProbe(workspace, createdThreadIds);
    observations["CSI-014"] = await schemaProbe(schemaRoot);
  } finally {
    if (primary) await primary.close().catch(() => {});
    const cleanup = new CodexAppServerClient({ command: "codex", requestTimeoutMs: 60_000 });
    let deleted = 0;
    try {
      await cleanup.start();
      for (const threadId of createdThreadIds) {
        await cleanup.request("thread/delete", { threadId }).catch(() => {});
        try {
          await cleanup.request("thread/read", { threadId, includeTurns: false });
        } catch {
          deleted += 1;
        }
      }
    } finally {
      await cleanup.close().catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
    observations.cleanup = { syntheticThreads: createdThreadIds.size, confirmedDeleted: deleted, temporaryRootRemoved: true };
  }

  assert.equal(observations.cleanup.confirmedDeleted, observations.cleanup.syntheticThreads);
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, results: observations }, null, 2)}\n`);
}

async function startSyntheticThread(client, cwd, label) {
  return client.request("thread/start", {
    cwd,
    approvalPolicy: "never",
    sandbox: "read-only",
    ephemeral: false,
    serviceName: `relay_csi_${label}`,
    threadSource: "relay.csi.probe",
  });
}

async function listPages(client, params) {
  const pages = [];
  let cursor = null;
  do {
    const page = await client.request("thread/list", { ...params, cursor });
    pages.push({ data: page.data ?? [], nextCursor: page.nextCursor ?? null });
    cursor = page.nextCursor ?? null;
  } while (cursor !== null);
  return pages;
}

async function runCodexExec(cwd, marker) {
  const { stdout, stderr } = await run("codex", [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--ignore-rules",
    "--sandbox",
    "read-only",
    "-C",
    cwd,
    `Reply with exactly: ${marker}`,
  ], { cwd });
  const events = stdout.split("\n").filter(Boolean).map(line => JSON.parse(line));
  const started = events.find(event => event.type === "thread.started");
  assert.ok(started?.thread_id, `codex exec did not return a thread id; stderr hash=${hash(stderr)}`);
  assert.ok(stdout.includes(marker));
  return { threadId: started.thread_id, eventTypes: events.map(event => event.type) };
}

async function profileIsolationProbe(root) {
  const alternateProfile = join(root, "alternate-codex-profile");
  await mkdir(alternateProfile, { recursive: true });
  const normal = await oneShotThreadList(process.env);
  const alternate = await oneShotThreadList({ ...process.env, CODEX_HOME: alternateProfile });
  assert.ok(normal.count > 0);
  assert.equal(alternate.count, 0);
  return {
    result: "pass",
    normalProfileHasThreads: true,
    isolatedTemporaryProfileCount: alternate.count,
    profileSelectionChangesInventory: true,
  };
}

async function concurrentTurnProbe(cwd, createdThreadIds) {
  const started = await runCodexExec(cwd, "CSI-CONCURRENT-BASE");
  createdThreadIds.add(started.threadId);

  const clients = [0, 1].map(() => new CodexAppServerClient({ command: "codex", requestTimeoutMs: 60_000 }));
  const runtimes = clients.map(client => new CodexSessionRuntime({ client, cwd }));
  try {
    const snapshots = await Promise.all(runtimes.map(runtime => runtime.initialize()));
    const defaults = snapshots.map(snapshot => {
      const model = snapshot.models.find(candidate => candidate.isDefault) ?? snapshot.models[0];
      return {
        cwd,
        model: model.id,
        effort: model.defaultReasoningEffort,
        sandbox: "read-only",
        approvalPolicy: "never",
      };
    });
    await runtimes[0].resumeSession(started.threadId, defaults[0]);
    let activeWriterRejected = false;
    try {
      await runtimes[1].resumeSession(started.threadId, defaults[1]);
    } catch (error) {
      activeWriterRejected = /active writer/i.test(error.message);
    }
    assert.equal(activeWriterRejected, true);
    await runtimes[0].close();
    const takeover = await runtimes[1].resumeSession(started.threadId, defaults[1]);
    assert.equal(takeover.id, started.threadId);
    return {
      result: "pass",
      simultaneousWritersAttempted: 2,
      activeWriterRejected,
      takeoverAfterOwnerExit: true,
      requiresPluginLease: false,
      pluginBehavior: "surface-active-writer-and-retry",
    };
  } finally {
    await Promise.all(runtimes.map(runtime => runtime.close().catch(() => {})));
  }
}

async function schemaProbe(schemaRoot) {
  await run("codex", ["app-server", "generate-json-schema", "--out", schemaRoot], { cwd: process.cwd() });
  const names = ["ThreadListParams.json", "ThreadResumeParams.json", "ThreadReadParams.json", "ThreadArchiveParams.json", "ThreadDeleteParams.json"];
  const summaries = {};
  for (const name of names) {
    const bytes = await readFile(join(schemaRoot, "v2", name));
    const schema = JSON.parse(bytes.toString("utf8"));
    summaries[name] = {
      required: schema.required ?? [],
      properties: Object.keys(schema.properties ?? {}).sort(),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  const sourceKinds = JSON.parse(await readFile(join(schemaRoot, "v2", "ThreadListParams.json"), "utf8"))
    .definitions.ThreadSourceKind.enum;
  assert.ok(sourceKinds.includes("exec"));
  assert.ok(sourceKinds.includes("appServer"));
  return { result: "pass", generatedFromInstalledVersion: true, sourceKinds, schemas: summaries };
}

async function oneShotThreadList(env) {
  const child = spawn("codex", ["app-server"], { env, stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";
  const pending = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", chunk => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.id != null && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    }
  });
  const request = (id, method, params) => new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  });
  try {
    await request(1, "initialize", { clientInfo: { name: "relay-csi", title: "Relay CSI", version: "1.0.0" }, capabilities: { experimentalApi: true } });
    child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
    const result = await request(2, "thread/list", { limit: 1, sourceKinds: ALL_SOURCES });
    return { count: result.data?.length ?? 0, hasNext: Boolean(result.nextCursor) };
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve => child.once("exit", resolve));
  }
}

async function run(command, args, { cwd, env = process.env }) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", resolveExit);
  });
  if (code !== 0) throw new Error(`${command} failed with ${code}; stderr hash=${hash(stderr)}`);
  return { stdout, stderr };
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

await main();
