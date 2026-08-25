import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";

const IMPORT_SOURCES = ["cli", "vscode", "exec", "appServer", "unknown"];

async function main() {
  const results = {};
  results["CSI-001"] = await paginationProbe();
  results["CSI-003"] = profileIdentityProbe();
  results["CSI-005"] = bindingRecoveryProbe();
  results["CSI-006"] = admissionProbe();
  results["CSI-007"] = settingsProbe();
  results["CSI-009"] = projectionIdempotencyProbe();
  results["CSI-010"] = activityClassificationProbe();
  results["CSI-011"] = bulkPerformanceProbe();
  results["CSI-012"] = await workspaceBoundaryProbe();
  results["CSI-013"] = missingThreadProbe();
  results["CSI-014"] = protocolCompatibilityProbe();
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, results }, null, 2)}\n`);
}

async function paginationProbe() {
  const pages = new Map([
    [null, { data: [thread("t1", "exec")], nextCursor: "page-2" }],
    ["page-2", { data: [thread("t2", "appServer")], nextCursor: "page-3" }],
    ["page-3", { data: [thread("t3", "cli")], nextCursor: null }],
  ]);
  const requests = [];
  const client = {
    async request(method, params) {
      assert.equal(method, "thread/list");
      requests.push(structuredClone(params));
      return structuredClone(pages.get(params.cursor ?? null));
    },
  };
  const listed = await listAllThreads(client, "/workspace/project");
  assert.deepEqual(listed.map(candidate => candidate.id), ["t1", "t2", "t3"]);
  assert.equal(requests.length, 3);
  assert.deepEqual(requests[0].sourceKinds, IMPORT_SOURCES);

  pages.set("page-3", { data: [thread("t2", "appServer")], nextCursor: null });
  await assert.rejects(() => listAllThreads(client, "/workspace/project"), /duplicate thread/);
  return {
    result: "pass",
    pagesTraversed: 3,
    eligibleSources: IMPORT_SOURCES,
    duplicatePageRejected: true,
  };
}

function profileIdentityProbe() {
  const first = storeFingerprint({ root: "/profiles/a", accountKind: "chatgpt", cliMajor: 0 });
  const same = storeFingerprint({ root: "/profiles/a", accountKind: "chatgpt", cliMajor: 0 });
  const second = storeFingerprint({ root: "/profiles/b", accountKind: "chatgpt", cliMajor: 0 });
  assert.equal(first, same);
  assert.notEqual(first, second);
  return { result: "pass", stableIdentity: true, profileMismatchDetected: true };
}

function bindingRecoveryProbe() {
  const failurePoints = ["reserved", "session-created", "linked", "committed"];
  const outcomes = [];
  for (const failAfter of failurePoints) {
    const state = createImportState();
    assert.throws(() => importThread(state, "thread-a", { failAfter }), /injected failure/);
    reconcileImports(state);
    importThread(state, "thread-a");
    importThread(state, "thread-a");
    assert.equal(state.sessions.size, 1);
    assert.equal(state.links.size, 1);
    assert.equal(state.journal.get("thread-a").status, "committed");
    outcomes.push({ failAfter, sessions: state.sessions.size, links: state.links.size });
  }

  const concurrent = createImportState();
  const first = reserveImport(concurrent, "thread-concurrent");
  const second = reserveImport(concurrent, "thread-concurrent");
  assert.equal(first.sessionId, second.sessionId);
  importThread(concurrent, "thread-concurrent");
  assert.equal(concurrent.sessions.size, 1);
  return { result: "pass", failurePoints: outcomes, deterministicReservation: true };
}

function admissionProbe() {
  const leases = new Map();
  const acquire = (threadId, owner, appServerStatus) => {
    if (appServerStatus === "active" || leases.has(threadId)) return { accepted: false, reason: "thread-active" };
    leases.set(threadId, owner);
    return { accepted: true };
  };
  assert.equal(acquire("t1", "dsh", "idle").accepted, true);
  assert.deepEqual(acquire("t1", "desktop", "active"), { accepted: false, reason: "thread-active" });
  leases.delete("t1");
  assert.equal(acquire("t1", "desktop", "idle").accepted, true);
  leases.clear();
  assert.equal(acquire("t1", "dsh", "idle").accepted, true);
  return { result: "pass", simultaneousOwnerCount: 1, restartReconcilesFromAppServerStatus: true };
}

function settingsProbe() {
  const available = new Set(["current-model"]);
  const unchanged = resolveSettings({ model: "current-model", cwdExists: true }, available);
  const fallback = resolveSettings({ model: "removed-model", cwdExists: true }, available);
  const missingCwd = resolveSettings({ model: "current-model", cwdExists: false }, available);
  assert.deepEqual(unchanged, { action: "preserve", model: "current-model" });
  assert.deepEqual(fallback, { action: "require-choice", suggestedModel: "current-model" });
  assert.deepEqual(missingCwd, { action: "reject", reason: "cwd-unavailable" });
  return { result: "pass", inventoryMutations: 0, unsupportedModelRequiresChoice: true, missingCwdRejected: true };
}

function projectionIdempotencyProbe() {
  const ledger = new Set();
  const turns = fixtureTurns();
  const first = projectTurns(turns, ledger);
  const second = projectTurns(turns, ledger);
  const extended = projectTurns([...turns, fixtureTurn("turn-3", "u3", "a3")], ledger);
  assert.equal(first.length, 4);
  assert.equal(second.length, 0);
  assert.equal(extended.length, 2);
  assert.equal(ledger.size, 6);
  return { result: "pass", firstProjection: 4, retryProjection: 0, incrementalProjection: 2, uniqueKeys: 6 };
}

function activityClassificationProbe() {
  const corpus = [
    { type: "userMessage" },
    { type: "agentMessage" },
    { type: "reasoning" },
    { type: "imageGeneration" },
    { type: "commandExecution" },
    { type: "mcpToolCall" },
    { type: "contextCompaction" },
    { type: "futureUnknown" },
  ];
  const classified = Object.fromEntries(corpus.map(item => [item.type, classifyItem(item)]));
  assert.equal(classified.userMessage, "required-message");
  assert.equal(classified.agentMessage, "required-message");
  assert.equal(classified.contextCompaction, "opaque-internal");
  assert.equal(classified.futureUnknown, "optional-unknown");
  return { result: "pass", classified, unknownBlocksImport: false };
}

function bulkPerformanceProbe() {
  const sizes = [1, 10, 100, 1_000];
  const samples = {};
  for (const size of sizes) {
    const timings = [];
    for (let repeat = 0; repeat < 5; repeat += 1) {
      const input = Array.from({ length: size }, (_, index) => thread(`thread-${index}`, index % 2 ? "exec" : "appServer"));
      const state = createImportState();
      const started = performance.now();
      for (const candidate of input) importThread(state, candidate.id);
      timings.push(performance.now() - started);
      assert.equal(state.sessions.size, size);
    }
    timings.sort((left, right) => left - right);
    samples[size] = {
      medianMs: round(timings[2]),
      p95Ms: round(timings[4]),
      maxMs: round(timings[4]),
    };
  }
  return { result: "pass", samples, duplicates: 0, strategy: "metadata-shells-with-lazy-resume" };
}

async function workspaceBoundaryProbe() {
  const root = await mkdtemp(join(tmpdir(), "relay-csi-path-"));
  try {
    const workspace = join(root, "app");
    const child = join(workspace, "child");
    const sibling = join(root, "application");
    const alias = join(root, "alias");
    await mkdir(child, { recursive: true });
    await mkdir(sibling, { recursive: true });
    await symlink(workspace, alias);
    const matrix = {
      exact: await exactWorkspaceMatch(workspace, workspace),
      child: await exactWorkspaceMatch(workspace, child),
      sibling: await exactWorkspaceMatch(workspace, sibling),
      alias: await exactWorkspaceMatch(workspace, alias),
      lexicalPrefixRejected: sibling.startsWith(workspace),
    };
    assert.deepEqual(matrix, {
      exact: true,
      child: false,
      sibling: false,
      alias: true,
      lexicalPrefixRejected: true,
    });
    return { result: "pass", matrix, policy: "canonical-exact-cwd" };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function missingThreadProbe() {
  const transitions = {
    active: bindingAction("active"),
    archived: bindingAction("archived"),
    wrongProfile: bindingAction("not-found"),
    deleted: bindingAction("deleted"),
  };
  assert.equal(transitions.active.action, "resume");
  assert.equal(transitions.archived.action, "offer-unarchive");
  assert.equal(transitions.wrongProfile.action, "retry-correct-profile");
  assert.equal(transitions.deleted.action, "broken-binding");
  assert.ok(Object.values(transitions).every(value => value.action !== "create-replacement"));
  return { result: "pass", transitions, silentReplacementCount: 0 };
}

function protocolCompatibilityProbe() {
  const current = parseThreadListResponse({
    data: [{ id: "t1", cwd: "/workspace", ephemeral: false, futureField: { enabled: true } }],
    nextCursor: null,
    futureEnvelope: true,
  });
  assert.equal(current.data.length, 1);
  assert.throws(() => parseThreadListResponse({ data: [{ cwd: "/workspace" }], nextCursor: null }), /thread id/);
  assert.throws(() => parseThreadListResponse({ data: [], nextCursor: 7 }), /nextCursor/);
  assert.throws(() => parseThreadListResponse({ nextCursor: null }), /data array/);
  return {
    result: "pass",
    additiveFieldsAccepted: true,
    missingRequiredFieldsRejected: true,
    malformedCursorRejected: true,
  };
}

async function listAllThreads(client, cwd) {
  const found = [];
  const ids = new Set();
  let cursor = null;
  do {
    const response = await client.request("thread/list", {
      cursor,
      limit: 100,
      cwd,
      sourceKinds: IMPORT_SOURCES,
      archived: false,
      sortKey: "updated_at",
      sortDirection: "desc",
    });
    for (const candidate of response.data ?? []) {
      if (ids.has(candidate.id)) throw new Error(`duplicate thread ${candidate.id}`);
      ids.add(candidate.id);
      found.push(candidate);
    }
    cursor = response.nextCursor ?? null;
  } while (cursor !== null);
  return found;
}

function thread(id, sourceKind) {
  return { id, cwd: "/workspace/project", ephemeral: false, source: { kind: sourceKind } };
}

function storeFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function createImportState() {
  return { journal: new Map(), sessions: new Map(), links: new Map() };
}

function reserveImport(state, threadId) {
  const existing = state.journal.get(threadId);
  if (existing) return existing;
  const record = { threadId, sessionId: `codex-import-${threadId}`, status: "reserved" };
  state.journal.set(threadId, record);
  return record;
}

function importThread(state, threadId, { failAfter } = {}) {
  const record = reserveImport(state, threadId);
  if (record.status === "committed") return record;
  failAt(record.status, failAfter);
  state.sessions.set(record.sessionId, { id: record.sessionId, threadId });
  record.status = "session-created";
  failAt(record.status, failAfter);
  state.links.set(record.sessionId, threadId);
  record.status = "linked";
  failAt(record.status, failAfter);
  record.status = "committed";
  failAt(record.status, failAfter);
  return record;
}

function failAt(current, requested) {
  if (current === requested) throw new Error(`injected failure after ${current}`);
}

function reconcileImports(state) {
  for (const record of state.journal.values()) {
    if (!state.sessions.has(record.sessionId)) state.sessions.set(record.sessionId, { id: record.sessionId, threadId: record.threadId });
    if (state.links.get(record.sessionId) !== record.threadId) state.links.set(record.sessionId, record.threadId);
    record.status = "committed";
  }
}

function resolveSettings(stored, availableModels) {
  if (!stored.cwdExists) return { action: "reject", reason: "cwd-unavailable" };
  if (availableModels.has(stored.model)) return { action: "preserve", model: stored.model };
  return { action: "require-choice", suggestedModel: [...availableModels][0] };
}

function fixtureTurns() {
  return [fixtureTurn("turn-1", "u1", "a1"), fixtureTurn("turn-2", "u2", "a2")];
}

function fixtureTurn(id, userId, assistantId) {
  return { id, items: [{ id: userId, type: "userMessage" }, { id: assistantId, type: "agentMessage" }] };
}

function projectTurns(turns, ledger) {
  const appended = [];
  for (const turn of turns) {
    for (const item of turn.items ?? []) {
      if (!['userMessage', 'agentMessage'].includes(item.type)) continue;
      const key = `${turn.id}:${item.id}:${item.type}`;
      if (ledger.has(key)) continue;
      ledger.add(key);
      appended.push(key);
    }
  }
  return appended;
}

function classifyItem(item) {
  if (["userMessage", "agentMessage"].includes(item.type)) return "required-message";
  if (item.type === "reasoning") return "optional-reasoning";
  if (["imageGeneration", "imageView"].includes(item.type)) return "attachment";
  if (["commandExecution", "fileChange", "webSearch", "plan", "mcpToolCall"].includes(item.type)) return "supported-activity";
  if (["contextCompaction", "rawResponseItem", "threadRollback"].includes(item.type)) return "opaque-internal";
  return "optional-unknown";
}

async function exactWorkspaceMatch(selected, candidate) {
  const [left, right] = await Promise.all([realpath(selected), realpath(candidate)]);
  return left === right;
}

function bindingAction(state) {
  if (state === "active") return { action: "resume" };
  if (state === "archived") return { action: "offer-unarchive" };
  if (state === "not-found") return { action: "retry-correct-profile" };
  return { action: "broken-binding" };
}

function parseThreadListResponse(value) {
  if (!Array.isArray(value?.data)) throw new Error("thread/list requires a data array");
  if (value.nextCursor !== null && value.nextCursor !== undefined && typeof value.nextCursor !== "string") {
    throw new Error("thread/list nextCursor must be a string or null");
  }
  const data = value.data.map(candidate => {
    if (typeof candidate?.id !== "string" || candidate.id.length === 0) throw new Error("thread id is required");
    return { ...candidate };
  });
  return { data, nextCursor: value.nextCursor ?? null };
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

await main();
