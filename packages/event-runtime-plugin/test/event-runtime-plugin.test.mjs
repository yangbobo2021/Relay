import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PluginHost, definePlugin } from "../../plugin-sdk/index.mjs";
import { createEventRuntimePlugin } from "../index.mjs";

test("event runtime uses an injected delivery capability and unloads cleanly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "relay-event-plugin-"));
  const delivered = [];
  const delivery = definePlugin({
    manifest: {
      id: "test.delivery",
      version: "1.0.0",
      provides: { "relay.delivery.v1": "1.0.0" },
    },
    activate() {
      return {
        capabilities: {
          "relay.delivery.v1": {
            async deliver(input) { delivered.push(structuredClone(input)); },
          },
        },
      };
    },
  });
  const host = new PluginHost();

  try {
    await host.activate([
      createEventRuntimePlugin({
        databasePath: join(directory, "relay.sqlite"),
        pollIntervalMs: 60_000,
      }),
      delivery,
    ]);
    const events = host.capabilities.require("relay.events.v1", "^1.0.0");
    const monitors = host.capabilities.require("relay.monitors.v1", "^1.0.0");
    assert.deepEqual(Object.keys(events).sort(), [
      "cancelWaits", "dispatchSession", "handleEvent", "listWaits", "registerWaits",
    ]);
    assert.deepEqual(Object.keys(monitors).sort(), ["checkMonitor", "createTimerWait", "runDue"]);

    await events.registerWaits({
      sessionId: "session-plugin",
      taskSummary: "Wait for plugin event.",
      waits: [{
        wait_id: "wait-plugin",
        phase: "waiting",
        exclusive: true,
        expected_event: "plugin.ready",
        caused_by: "test",
        actors: [],
        entities: [],
        prior_exchange: "Continue after plugin event.",
      }],
    });
    const result = await events.handleEvent({
      event_id: "event-plugin",
      source: "test",
      fingerprint: "plugin-ready-1",
      type: "plugin.ready",
    });
    assert.equal(result.event.state, "resolved");
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].sessionId, "session-plugin");

    await host.dispose();
    assert.throws(() => host.capabilities.require("relay.events.v1"), /not available/);
    await rm(directory, { recursive: true });
  } finally {
    await host.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("event runtime fails before activation when delivery is absent", async () => {
  const host = new PluginHost();
  await assert.rejects(host.activate([createEventRuntimePlugin()]), /requires relay\.delivery\.v1/);
});

test("event runtime waits for in-flight monitor work before closing its store", async () => {
  const directory = await mkdtemp(join(tmpdir(), "relay-event-disposal-"));
  let releaseObservation;
  let markObservationStarted;
  const observationStarted = new Promise((resolve) => { markObservationStarted = resolve; });
  const blockedObservation = new Promise((resolve) => { releaseObservation = resolve; });
  const observer = {
    async observe({ phase }) {
      if (phase === "baseline") return { observed_at: new Date().toISOString() };
      markObservationStarted();
      return blockedObservation;
    },
  };
  const delivery = definePlugin({
    manifest: {
      id: "disposal.delivery",
      version: "1.0.0",
      provides: { "relay.delivery.v1": "1.0.0" },
    },
    activate: () => ({ capabilities: { "relay.delivery.v1": { async deliver() {} } } }),
  });
  const host = new PluginHost();

  try {
    await host.activate([
      createEventRuntimePlugin({
        databasePath: join(directory, "relay.sqlite"),
        pollIntervalMs: 60_000,
        observer,
      }),
      delivery,
    ]);
    const events = host.capabilities.require("relay.events.v1");
    const monitors = host.capabilities.require("relay.monitors.v1");
    const proposal = monitors.createTimerWait({
      sessionId: "session-disposal",
      afterSeconds: 60,
      resumePrompt: "Resume after disposal test.",
    });
    await events.registerWaits(proposal);
    const check = monitors.checkMonitor(proposal.timer.timer_id, { force: true });
    await observationStarted;

    let disposalSettled = false;
    const disposal = host.dispose().then(() => { disposalSettled = true; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(disposalSettled, false);
    assert.throws(() => events.listWaits(), /shutting down/);

    releaseObservation({ observed_at: new Date().toISOString() });
    await check;
    await disposal;
    await rm(directory, { recursive: true });
  } finally {
    releaseObservation?.({ observed_at: new Date().toISOString() });
    await host.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
