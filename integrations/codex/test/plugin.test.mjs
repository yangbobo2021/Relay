import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { PluginHost } from "../../../packages/plugin-sdk/index.mjs";
import { createCodexExecutionPlugin } from "../plugin.mjs";

test("Codex plugin exposes operation capabilities and releases subscriptions", async () => {
  const client = new FakeCodexClient();
  const host = new PluginHost();
  await host.activate([createCodexExecutionPlugin({ client, cwd: "/workspace" })]);
  const execution = host.capabilities.require("relay.execution.codex.v1", "^1.0.0");
  const terminal = host.capabilities.require("relay.terminal.codex.v1", "^1.0.0");

  await execution.whenReady();
  assert.deepEqual(execution.listModels().map((model) => model.id), ["codex-test"]);
  assert.equal("runtime" in execution, false);
  assert.equal("client" in execution, false);
  const requests = [];
  const stop = execution.subscribeRequest((request) => requests.push(request.id));
  client.emit("serverRequest", { id: "request-1", method: "test", params: {} });
  assert.deepEqual(requests, ["request-1"]);
  stop();
  client.emit("serverRequest", { id: "request-2", method: "test", params: {} });
  assert.deepEqual(requests, ["request-1"]);

  assert.equal(await terminal.request("terminal/test", {}), "ok");
  await host.dispose();
  assert.equal(client.closed, true);
});

class FakeCodexClient extends EventEmitter {
  constructor() {
    super();
    this.closed = false;
  }

  async start() {}

  async request(method) {
    if (method === "model/list") return { data: [{ id: "codex-test", isDefault: true }] };
    if (method === "account/read") return null;
    if (method === "thread/list") return { data: [] };
    if (method === "terminal/test") return "ok";
    throw new Error(`unexpected request ${method}`);
  }

  respond() {}
  respondError() {}
  async close() { this.closed = true; }
}
