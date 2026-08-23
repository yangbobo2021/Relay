import assert from "node:assert/strict";
import test from "node:test";

import { Context } from "@deepseek-ai/cordis";
import { PluginHost, definePlugin } from "@relay/plugin-sdk";

import {
  DSH_WEB_DISTRIBUTION,
  createDshWebDistribution,
} from "../distribution.mjs";
import { createDshCompositionPlugin } from "../dsh-plugin.js";
import { apply as applyHostPlugin } from "../host-plugin.js";

test("DSH web distribution is declarative and plugins can be selected by id", () => {
  assert.equal(DSH_WEB_DISTRIBUTION.id, "relay.distribution.dsh-web");
  assert.deepEqual(DSH_WEB_DISTRIBUTION.plugins, [
    "relay.dsh.platform",
    "relay.event-runtime",
    "relay.execution.codex",
    "relay.execution.claude",
    "relay.dsh.composition",
  ]);

  const selected = createDshWebDistribution({}, {
    plugins: ["relay.dsh.platform", "relay.execution.codex", "relay.dsh.composition"],
    codex: { client: fakeClient() },
  });
  assert.deepEqual(selected.map((plugin) => plugin.manifest.id), [
    "relay.dsh.platform",
    "relay.execution.codex",
    "relay.dsh.composition",
  ]);
});

test("distribution rejects unknown and structurally invalid selections", () => {
  assert.throws(() => createDshWebDistribution({}, { plugins: ["unknown"] }), /unknown plugin/);
  assert.throws(
    () => createDshWebDistribution({}, { plugins: ["relay.event-runtime"] }),
    /requires relay\.dsh\.platform/,
  );
});

test("DSH composition activates against a fake capability and releases its listeners", async () => {
  let listeners = 0;
  const ctx = {
    agents: { get: () => null, list: () => [], roots: () => [] },
    on() {
      listeners += 1;
      return () => { listeners -= 1; };
    },
  };
  const workspace = definePlugin({
    manifest: {
      id: "fake.dsh.workspace",
      version: "1.0.0",
      provides: { "relay.dsh.workspace.v1": "1.0.0" },
    },
    activate: () => ({
      capabilities: { "relay.dsh.workspace.v1": { async resolveAgent() { return null; } } },
    }),
  });
  const host = new PluginHost();
  await host.activate([createDshCompositionPlugin(ctx), workspace]);
  assert.deepEqual(host.capabilities.require("relay.dsh.integration.v1"), {
    backends: [],
    events: false,
  });
  assert.equal(listeners, 4);
  await host.dispose();
  assert.equal(listeners, 0);
});

test("Codex-only composition does not advertise Event Runtime tools", async () => {
  const adapters = [];
  const ctx = {
    agents: { get: () => null, list: () => [], roots: () => [] },
    attachments: null,
    logger: console,
    llm: {
      registerAdapter(_providers, adapter) {
        adapters.push(adapter);
        return () => {};
      },
    },
    on: () => () => {},
  };
  const workspace = capabilityPlugin("fake.workspace", "relay.dsh.workspace.v1", {
    async resolveAgent() { return null; },
  });
  const codex = capabilityPlugin("fake.codex", "relay.execution.codex.v1", fakeCodexExecution());
  const host = new PluginHost();

  await host.activate([createDshCompositionPlugin(ctx), workspace, codex]);
  assert.equal(adapters.length, 1);
  assert.deepEqual(adapters[0].dynamicTools.map((tool) => tool.name), ["codex_app"]);
  await host.dispose();
});

test("DSH composition rolls back resources acquired before activation fails", async () => {
  const events = [];
  const ctx = {
    agents: { get: () => null, list: () => [], roots: () => [] },
    attachments: null,
    logger: console,
    llm: {
      registerAdapter() {
        events.push("register-adapter");
        return () => { events.push("dispose-adapter"); };
      },
    },
    on: () => () => {},
  };
  const workspace = capabilityPlugin("rollback.workspace", "relay.dsh.workspace.v1", {
    async resolveAgent() { return null; },
  });
  const codex = definePlugin({
    manifest: {
      id: "rollback.codex",
      version: "1.0.0",
      provides: { "relay.execution.codex.v1": "1.0.0" },
    },
    activate: () => ({
      capabilities: {
        "relay.execution.codex.v1": {
          ...fakeCodexExecution(),
          subscribeRequest() {
            events.push("subscribe-request");
            throw new Error("subscription failed");
          },
        },
      },
      dispose: () => { events.push("dispose-codex-provider"); },
    }),
  });

  const host = new PluginHost();
  await assert.rejects(
    host.activate([createDshCompositionPlugin(ctx), workspace, codex]),
    /subscription failed/,
  );
  assert.deepEqual(events, [
    "register-adapter",
    "subscribe-request",
    "dispose-adapter",
    "dispose-codex-provider",
  ]);
});

test("DSH Remote services and subscriptions unload with their Cordis child scope", async () => {
  const ctx = new Context();
  let subscriptions = 0;
  ctx.agents = { get: () => null, list: () => [], roots: () => [] };
  const workspace = capabilityPlugin("remote.workspace", "relay.dsh.workspace.v1", {
    async resolveAgent() { return null; },
  });
  const terminal = capabilityPlugin("remote.terminal", "relay.terminal.codex.v1", {
    whenReady: () => Promise.resolve(),
    async request() {},
    subscribeNotification() {
      subscriptions += 1;
      return () => { subscriptions -= 1; };
    },
  });
  const host = new PluginHost();

  try {
    await host.activate([createDshCompositionPlugin(ctx), workspace, terminal]);
    assert.ok(ctx.get("relayWorkbenchTerminal"));
    assert.equal(subscriptions, 1);
    await host.dispose();
    assert.equal(ctx.get("relayWorkbenchTerminal"), undefined);
    assert.equal(subscriptions, 0);
  } finally {
    await host.dispose();
    await ctx.fiber.dispose();
  }
});

test("DSH Host belongs to Cordis before any selected plugin starts", async () => {
  const events = [];
  const ctx = {
    effect(execute) {
      events.push("own-host");
      const cleanup = execute();
      return async () => {
        events.push("release-host");
        await cleanup();
      };
    },
  };
  const client = {
    on() {
      events.push("activate-codex");
      throw new Error("Codex client construction failed");
    },
  };

  await assert.rejects(
    applyHostPlugin(ctx, { plugins: ["relay.execution.codex"], codex: { client } }),
    /Codex client construction failed/,
  );
  assert.deepEqual(events, ["own-host", "activate-codex", "release-host"]);
});

function fakeClient() {
  return { on() {}, off() {}, close() {} };
}

function capabilityPlugin(id, capability, value) {
  return definePlugin({
    manifest: { id, version: "1.0.0", provides: { [capability]: "1.0.0" } },
    activate: () => ({ capabilities: { [capability]: value } }),
  });
}

function fakeCodexExecution() {
  return {
    whenReady: () => Promise.resolve(),
    listModels: () => [],
    hasSession: () => false,
    getSession: () => null,
    patchSession: () => false,
    async createSession() {},
    async resumeSession() {},
    async sendMessage() {},
    async interruptTurn() {},
    async releaseSession() {},
    async resolveRequest() {},
    respondDynamicTool() {},
    rejectRequest() {},
    subscribeActivity: () => () => {},
    subscribeRequest: () => () => {},
  };
}
