import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { Context } from "@deepseek-ai/cordis";
import { RelayEventsService } from "../../integrations/events/events-service.js";
import * as monitorPlugin from "../../integrations/monitors/host-plugin.js";

test("MB03-010: expired custom Bundle terminalizes its Monitor and Wait without an Event", async t => {
  let now = new Date("2026-09-02T00:00:00.000Z");
  const root = await mkdtemp(join(tmpdir(), "relay-custom-expiry-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const ctx = new Context();
  const tools = new Map();
  const agent = { id: "expiry-session", session: { header: { cwd: root } }, ctx: { tools: { register(tool) {
    tools.set(tool.name, tool); return () => tools.delete(tool.name);
  } } } };
  ctx.provide("agents", { roots: () => [agent] });
  ctx.provide("tools", {});
  await ctx.plugin(monitorPlugin, { artifactDirectory: join(root, "artifacts"), pollIntervalMs: 60_000, clock: () => new Date(now) });
  const releaseCapability = ctx.reflect.get("relayMonitorCapabilities").registerCapabilityProvider({
    api_version: 1, id: "fixture.expiry", provider_version: 1,
    operations: { read: {
      class: "read",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      result: { type: "object", additionalProperties: false, required: ["state"], properties: { state: { const: "waiting" } } },
    } },
    authorize: ({ authorization }) => authorization.sessionId === "expiry-session",
    async execute() { return { state: "waiting" }; },
  });
  t.after(releaseCapability);
  let events;
  await ctx.plugin({ name: "expiry-events", apply(scope) {
    events = new RelayEventsService(scope, { databasePath: join(root, "events.sqlite"), clock: () => new Date(now), dispatchPollIntervalMs: 60_000,
      inbox: { async deliver() { throw new Error("expiry must not deliver"); } } });
    scope.effect(() => () => events.stop());
  } });
  await eventually(() => tools.has("relay_validate_monitor_bundle"));
  const validated = await tools.get("relay_validate_monitor_bundle").execute({
    source: `globalThis.monitor={observe(){return {provider:"fixture.expiry",operation:"read",arguments:{}}},detect(){return []}}`,
    manifest: {
      contract_version: 1, type_id: "custom.expiry", event_types: ["fixture.done"],
      capability_grants: [{ provider: "fixture.expiry", operation: "read", arguments: {} }], config: {}, lifecycle: "one_shot",
      schedule: { interval_seconds: 1, jitter_seconds: 0 }, expires_at: "2026-09-02T00:00:01.000Z",
      observation_schema: { type: "object", additionalProperties: false, required: ["state"], properties: { state: { const: "waiting" } } },
      event_data_schema: { type: "object", additionalProperties: false, properties: {} },
      locales: {
        "en-US": { name: "Expiry fixture", description: "Expires safely.", permissions: "Reads fixture state.", remediation: "Create a new Bundle." },
        "zh-CN": { name: "到期测试", description: "安全到期。", permissions: "读取测试状态。", remediation: "请创建新的 Bundle。" },
      },
    },
  });
  const installed = await tools.get("relay_install_monitor_bundle").execute({
    validation_id: validated.validationId, task_summary: "Wait until expiry", resume_prompt: "Continue only if the declared event occurs",
  });
  const monitorId = installed.monitorIds[0];
  now = new Date("2026-09-02T00:00:02.000Z");
  const result = await events.checkMonitor(monitorId, { force: true });
  assert.equal(result.status, "expired");
  const monitor = events.inspectMonitor(monitorId);
  assert.equal(monitor.state, "expired");
  assert.equal(monitor.terminal_reason.code, "bundle_expired");
  assert.equal(monitor.last_check.error_class, "bundle_expired");
  assert.equal(events.listWaits().length, 0);
  assert.equal((await events.managementSnapshot()).events.length, 0);
  assert.equal((await events.checkMonitor(monitorId, { force: true })).status, "inactive");
  await ctx.fiber.dispose();
});

async function eventually(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(predicate(), "custom expiry composition did not settle");
}
