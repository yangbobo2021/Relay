import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { CodexSessionRuntime } from "../session-runtime.mjs";

test("Codex threads keep their context across turns, switching, and resume", async () => {
  const client = new FakeCodexClient();
  const runtime = new CodexSessionRuntime({ client, cwd: "/workspace/relay" });
  await runtime.initialize();

  const tools = [{ type: "function", name: "relay_wait", description: "wait", inputSchema: {} }];
  const first = await runtime.createSession({ model: "codex-test", effort: "medium", dynamicTools: tools });
  await runtime.sendMessage(first.id, { text: "first turn" });
  await runtime.sendMessage(first.id, { text: "second turn" });
  const second = await runtime.createSession({ dynamicTools: tools });
  await runtime.sendMessage(second.id, { text: "other thread" });
  await runtime.resumeSession(first.id, { dynamicTools: tools });
  await runtime.sendMessage(first.id, { text: "third turn" });
  await tick();

  assert.equal(runtime.snapshot().selectedSessionId, first.id);
  assert.equal(runtime.getSession(first.id).turns.length, 3);
  assert.equal(runtime.getSession(second.id).turns.length, 1);
  assert.deepEqual(client.requests.find(request => request.method === "thread/start").params.dynamicTools, tools);
  assert.deepEqual(client.requests.find(request => request.method === "thread/resume").params.dynamicTools, tools);
  await runtime.close();
});

test("App Server notifications remain incremental and server requests remain interactive", async () => {
  const client = new FakeCodexClient();
  const runtime = new CodexSessionRuntime({ client, cwd: "/workspace/relay" });
  const activity = [];
  const requests = [];
  runtime.on("activity", message => activity.push(message));
  runtime.on("request", request => requests.push(request));
  await runtime.initialize();
  const session = await runtime.createSession();

  client.notify("item/reasoning/summaryTextDelta", {
    threadId: session.id, turnId: "turn-live", itemId: "reason-1", summaryIndex: 0, delta: "Inspecting.",
  });
  client.notify("item/commandExecution/outputDelta", {
    threadId: session.id, turnId: "turn-live", itemId: "command-1", delta: "result\n",
  });
  client.serverRequest("approval-1", "item/commandExecution/requestApproval", {
    threadId: session.id, turnId: "turn-live", command: "git status",
  });

  assert.deepEqual(activity.map(message => message.method), [
    "item/reasoning/summaryTextDelta", "item/commandExecution/outputDelta",
  ]);
  assert.equal(requests[0].id, "approval-1");
  assert.equal(runtime.snapshot().pendingRequests.length, 1);
  await runtime.resolveRequest("approval-1", { action: "accept" });
  assert.deepEqual(client.responses.at(-1), { id: "approval-1", result: { decision: "accept" } });
  await runtime.close();
});

test("dynamic tool replies, question answers, permission replies, and interruption use App Server protocol", async () => {
  const client = new FakeCodexClient();
  const runtime = new CodexSessionRuntime({ client, cwd: "/workspace/relay" });
  await runtime.initialize();
  const session = await runtime.createSession();

  client.serverRequest("tool-1", "item/tool/call", { threadId: session.id });
  runtime.respondDynamicTool("tool-1", true, "waiting");
  assert.deepEqual(client.responses.at(-1).result, {
    success: true,
    contentItems: [{ type: "inputText", text: "waiting" }],
  });

  client.serverRequest("question-1", "item/tool/requestUserInput", { threadId: session.id });
  await runtime.resolveRequest("question-1", { answers: { choice: ["yes"] } });
  assert.deepEqual(client.responses.at(-1).result, { answers: { choice: { answers: ["yes"] } } });

  client.serverRequest("permission-1", "item/permissions/requestApproval", {
    threadId: session.id, permissions: { network: true },
  });
  await runtime.resolveRequest("permission-1", { action: "accept" });
  assert.deepEqual(client.responses.at(-1).result, {
    permissions: { network: true }, scope: "turn",
  });

  await runtime.interruptTurn(session.id, "turn-live");
  assert.deepEqual(client.requests.at(-1), {
    method: "turn/interrupt", params: { threadId: session.id, turnId: "turn-live" },
  });
  await runtime.close();
});

test("only Relay-owned Codex threads are discovered and can be resumed after restart", async () => {
  const client = new FakeCodexClient();
  const first = new CodexSessionRuntime({ client, cwd: "/workspace/relay" });
  await first.initialize();
  const created = await first.createSession({ model: "codex-test", effort: "low" });
  await first.sendMessage(created.id, { text: "persist this turn" });
  await tick();
  await first.close();

  client.connected = true;
  client.threads.set("unrelated", { ...client.thread("unrelated", "/workspace/relay"), threadSource: null });
  const second = new CodexSessionRuntime({ client, cwd: "/workspace/relay" });
  await second.initialize();
  assert.ok(second.getSession(created.id));
  assert.equal(second.getSession("unrelated"), null);
  const resumed = await second.resumeSession(created.id);
  assert.equal(resumed.turns.length, 1);
  await second.close();
});

test("ephemeral auxiliary threads carry isolated instructions and are released", async () => {
  const client = new FakeCodexClient();
  const runtime = new CodexSessionRuntime({ client, cwd: "/workspace/relay" });
  await runtime.initialize();

  const session = await runtime.createSession({
    model: "codex-test",
    sandbox: "read-only",
    approvalPolicy: "never",
    dynamicTools: [],
    baseInstructions: "Generate a title.",
    developerInstructions: "Do not call tools.",
    ephemeral: true,
    serviceName: "relay_codex_auxiliary",
    threadSource: "relay.codex.auxiliary",
  });
  const start = client.requests.find(request => request.method === "thread/start");
  assert.equal(start.params.ephemeral, true);
  assert.equal(start.params.baseInstructions, "Generate a title.");
  assert.equal(start.params.developerInstructions, "Do not call tools.");
  assert.deepEqual(start.params.dynamicTools, []);
  assert.equal(session.ephemeral, true);

  await runtime.releaseSession(session.id);
  assert.equal(runtime.getSession(session.id), null);
  assert.deepEqual(client.requests.at(-1), {
    method: "thread/unsubscribe", params: { threadId: session.id },
  });
  await runtime.close();
});

class FakeCodexClient extends EventEmitter {
  constructor() {
    super();
    this.connected = true;
    this.requests = [];
    this.responses = [];
    this.errors = [];
    this.threads = new Map();
    this.threadSequence = 0;
    this.turnSequence = 0;
  }

  async start() {}
  async close() { this.connected = false; }

  async request(method, params = {}) {
    this.requests.push({ method, params: structuredClone(params) });
    if (method === "model/list") return { data: [model()] };
    if (method === "account/read") return { account: { type: "chatgpt", planType: "test" }, requiresOpenaiAuth: true };
    if (method === "thread/list") {
      return { data: [...this.threads.values()].filter(thread => thread.cwd === params.cwd && !thread.ephemeral).map(thread => ({ ...structuredClone(thread), turns: [] })) };
    }
    if (method === "thread/start") {
      const thread = this.thread(`thread-${++this.threadSequence}`, params.cwd);
      thread.threadSource = params.threadSource;
      thread.ephemeral = Boolean(params.ephemeral);
      this.threads.set(thread.id, thread);
      return { thread: structuredClone(thread) };
    }
    if (method === "thread/resume") return { thread: structuredClone(this.threads.get(params.threadId)) };
    if (method === "turn/start") return this.startTurn(params);
    if (method === "turn/interrupt") return {};
    if (method === "thread/unsubscribe") return { status: "unsubscribed" };
    throw new Error(`unexpected request ${method}`);
  }

  respond(id, result) { this.responses.push({ id, result: structuredClone(result) }); }
  respondError(id, code, message) { this.errors.push({ id, code, message }); }
  notify(method, params) { this.emit("notification", { method, params: structuredClone(params) }); }
  serverRequest(id, method, params) { this.emit("serverRequest", { id, method, params: structuredClone(params) }); }

  startTurn(params) {
    const thread = this.threads.get(params.threadId);
    const id = `turn-${++this.turnSequence}`;
    const user = { type: "userMessage", id: `${id}-user`, content: structuredClone(params.input) };
    const answer = { type: "agentMessage", id: `${id}-answer`, text: `completed ${id}`, phase: "final_answer" };
    const turn = { id, status: "completed", error: null, items: [user, answer] };
    thread.turns.push(turn);
    queueMicrotask(() => {
      this.notify("turn/started", { threadId: thread.id, turn: { id, status: "inProgress", error: null, items: [] } });
      this.notify("item/completed", { threadId: thread.id, turnId: id, item: answer });
      this.notify("turn/completed", { threadId: thread.id, turn });
    });
    return { turn: { id, status: "inProgress", error: null, items: [] } };
  }

  thread(id, cwd) {
    const now = Date.now() / 1000;
    return { id, sessionId: id, name: null, preview: "", cwd, status: { type: "idle" }, createdAt: now, updatedAt: now, turns: [] };
  }
}

function model() {
  return {
    id: "codex-test", displayName: "Codex Test", isDefault: true,
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: [{ reasoningEffort: "low" }, { reasoningEffort: "medium" }],
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
