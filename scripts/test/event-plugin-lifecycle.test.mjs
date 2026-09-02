import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import * as monitorPlugin from "../../integrations/monitors/host-plugin.js";
import * as timePlugin from "../../integrations/monitor-time/host-plugin.js";
import * as routerPlugin from "../../integrations/semantic-router/host-plugin.js";
import { RelayEventsService } from "../../integrations/events/events-service.js";

test("Cordis late Events activation, provider unload/reload and root-Agent tool cleanup", async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const artifactDirectory = await mkdtemp(join(tmpdir(), "relay-lifecycle-artifacts-"));
  t.after(() => rm(artifactDirectory, { recursive: true, force: true }));
  const accepted = [];
  const definitions = new Map();
  const agent = { id: "fixture-session", ctx: { tools: { register(definition) {
    assert.equal(definitions.has(definition.name), false, "tool must have one owner");
    definitions.set(definition.name, definition);
    return () => definitions.delete(definition.name);
  } } } };
  ctx.provide("agents", { roots: () => [agent] });
  ctx.provide("tools", {});
  ctx.provide("llm", { async * stream() { throw new Error("no model needed for lifecycle check"); } });
  const monitors = ctx.plugin(monitorPlugin, { pollIntervalMs: 60_000, artifactDirectory, logger: console });
  const router = ctx.plugin(routerPlugin, { provider: "fixture", model: "fixture" });
  await monitors; await router;
  assert.equal(definitions.size, 0, "Monitors is parked without Events");
  let events;
  const host = { name: "test-events-service", apply(scope) {
    events = new RelayEventsService(scope, { databasePath: ":memory:", inbox: { async deliver(value) { accepted.push(value); } } });
    scope.effect(() => () => events.stop());
  } };
  const first = ctx.plugin(host);
  await first;
  await eventually(() => events.monitorProvider && events.routerProvider);
  assert.deepEqual([...definitions.keys()].sort(), [
    "relay_create_monitor_from_type", "relay_install_monitor_bundle", "relay_list_monitor_bundle_types",
    "relay_rollback_monitor_bundle", "relay_update_monitor_bundle", "relay_validate_monitor_bundle",
  ]);
  let time = ctx.plugin(timePlugin, { clock: () => new Date("2026-08-30T00:00:00.000Z"), idFactory: () => "lifecycle" });
  await time;
  await eventually(() => definitions.has("relay_schedule_timer"));
  const catalog = await definitions.get("relay_list_monitor_bundle_types").execute({ locale: "zh-CN" });
  assert.deepEqual(catalog.bundleTypes.map(entry => entry.type_id), ["time.deadline"]);
  assert.deepEqual((await events.managementSnapshot({ locale: "zh-CN" })).bundle_types.map(entry => entry.type_id), ["time.deadline"]);
  const created = await definitions.get("relay_create_monitor_from_type").execute({
    type_id: "time.deadline",
    bundle_version: 1,
    task_summary: "继续生命周期验收",
    parameters: { after_seconds: 60, resume_prompt: "继续生命周期验收" },
  });
  assert.equal(created.created, true);
  assert.equal(events.inspectMonitor(created.monitorIds[0]).session_id, "fixture-session");
  await time.dispose();
  await eventually(() => events.inspectMonitor(created.monitorIds[0]).state === "degraded");
  assert.equal(events.inspectMonitor(created.monitorIds[0]).last_check.error_class, "provider_unavailable");
  assert.equal(definitions.has("relay_schedule_timer"), false, "Time unload removes only its convenience tool");
  assert.deepEqual((await events.managementSnapshot()).bundle_types, []);
  time = ctx.plugin(timePlugin, { clock: () => new Date("2026-08-30T00:00:00.000Z"), idFactory: () => "lifecycle-reloaded" });
  await time;
  await eventually(() => events.inspectMonitor(created.monitorIds[0]).state === "active");
  assert.equal(events.inspectMonitor(created.monitorIds[0]).consecutive_failures, 0);

  let processStatus = "running";
  const capabilityDefinition = {
    api_version: 1,
    id: "fixture.process",
    provider_version: 1,
    operations: { status: {
      class: "read",
      parameters: { type: "object", additionalProperties: false, required: ["handle"], properties: { handle: { const: "issued" } } },
      result: { type: "object", additionalProperties: false, required: ["handle", "identity", "status"], properties: {
        handle: { const: "issued" }, identity: { const: "host:pid:start" }, status: { enum: ["running", "exited"] },
      } },
    } },
    authorize: ({ authorization }) => authorization.sessionId === "fixture-session",
    async execute() { return { handle: "issued", identity: "host:pid:start", status: processStatus }; },
  };
  let releaseCapability = ctx.reflect.get("relayMonitorCapabilities").registerCapabilityProvider(capabilityDefinition);
  const customSource = `globalThis.monitor={
    observe(c){return {provider:"fixture.process",operation:"status",arguments:{handle:c.config.handle}}},
    detect(p,c){return p?.status==="running"&&c.status==="exited"?[{type:"process.exited",key:c.identity,data:c}]:[]}
  }`;
  const customManifest = {
    contract_version: 1, type_id: "custom.process-exit", event_types: ["process.exited"],
    capability_grants: [{ provider: "fixture.process", operation: "status", arguments: { handle: "issued" } }],
    config: { handle: "issued" }, lifecycle: "one_shot", schedule: { interval_seconds: 1, jitter_seconds: 0 },
    expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    observation_schema: { type: "object", additionalProperties: false, required: ["handle", "identity", "status"], properties: {
      handle: { type: "string" }, identity: { type: "string" }, status: { enum: ["running", "exited"] },
    } },
    event_data_schema: { type: "object", additionalProperties: false, required: ["handle", "identity", "status"], properties: {
      handle: { type: "string" }, identity: { type: "string" }, status: { const: "exited" },
    } },
    locales: {
      "en-US": { name: "Fixture process exit", description: "Wait for the fixture process.", permissions: "Reads one fixture state.", remediation: "Reload the fixture capability." },
      "zh-CN": { name: "测试进程退出", description: "等待测试进程。", permissions: "读取一个测试状态。", remediation: "请重新加载测试能力。" },
    },
  };
  const validated = await definitions.get("relay_validate_monitor_bundle").execute({
    source: customSource,
    manifest: customManifest,
  });
  const customInstalled = await definitions.get("relay_install_monitor_bundle").execute({
    validation_id: validated.validationId, task_summary: "等待测试进程退出", resume_prompt: "继续验收",
  });
  const initialCustom = events.inspectMonitor(customInstalled.monitorIds[0]);
  const revised = await definitions.get("relay_validate_monitor_bundle").execute({
    source: `${customSource}\n// revision 2`, manifest: { ...customManifest, config: { handle: "issued", revision: 2 } },
  });
  const updatedCustom = await definitions.get("relay_update_monitor_bundle").execute({
    monitor_id: customInstalled.monitorIds[0], validation_id: revised.validationId, expected_version: initialCustom.version,
  });
  assert.equal(updatedCustom.previousVersionId, initialCustom.active_version_id);
  const afterUpdate = events.inspectMonitor(customInstalled.monitorIds[0]);
  assert.equal(afterUpdate.versions.length, 2);
  assert.equal(afterUpdate.artifact.sha256, revised.artifactHash);
  const failing = await definitions.get("relay_validate_monitor_bundle").execute({
    source: `${customSource}\n// revision 3`, manifest: { ...customManifest, config: { handle: "issued", revision: 3 } },
  });
  processStatus = "malformed";
  await assert.rejects(definitions.get("relay_update_monitor_bundle").execute({
    monitor_id: customInstalled.monitorIds[0], validation_id: failing.validationId, expected_version: afterUpdate.version,
  }));
  const afterFailedUpdate = events.inspectMonitor(customInstalled.monitorIds[0]);
  assert.equal(afterFailedUpdate.active_version_id, afterUpdate.active_version_id);
  assert.equal(afterFailedUpdate.version, afterUpdate.version);
  assert.equal(afterFailedUpdate.versions.length, 2);
  processStatus = "running";
  const rolledBackCustom = await definitions.get("relay_rollback_monitor_bundle").execute({
    monitor_id: customInstalled.monitorIds[0], version_id: initialCustom.active_version_id, expected_version: afterUpdate.version,
  });
  assert.equal(rolledBackCustom.activeVersionId, initialCustom.active_version_id);
  assert.equal(events.inspectMonitor(customInstalled.monitorIds[0]).versions.length, 2);
  releaseCapability();
  await eventually(() => events.inspectMonitor(customInstalled.monitorIds[0]).state === "degraded");
  assert.equal(events.inspectMonitor(customInstalled.monitorIds[0]).last_check.error_class, "provider_unavailable");
  releaseCapability = ctx.reflect.get("relayMonitorCapabilities").registerCapabilityProvider(capabilityDefinition);
  await eventually(() => events.inspectMonitor(customInstalled.monitorIds[0]).state === "active");
  processStatus = "exited";
  const customTriggered = await events.checkMonitor(customInstalled.monitorIds[0], { force: true });
  assert.equal(customTriggered.status, "triggered");
  assert.equal(accepted.at(-1).deliveries[0].event.type, "process.exited");
  assert.equal(accepted.at(-1).sessionId, "fixture-session");
  releaseCapability();
  await time.dispose();
  assert.equal(definitions.has("relay_schedule_timer"), false, "Time unload removes only its convenience tool");
  assert.equal(definitions.has("relay_list_monitor_bundle_types"), true, "Core catalog tool remains active");
  const catalogAfterTimeUnload = (await definitions.get("relay_list_monitor_bundle_types").execute({})).bundleTypes;
  assert.ok(catalogAfterTimeUnload.length >= 3 && catalogAfterTimeUnload.every(entry => entry.type_id === "custom.process-exit"),
    "Time unload keeps every retained custom Bundle revision discoverable");
  assert.ok(catalogAfterTimeUnload.some(entry => entry.validation_state === "installed"));
  assert.ok((await events.managementSnapshot({ locale: "zh-CN" })).bundle_types.every(entry => entry.type_id === "custom.process-exit"));
  await router.dispose();
  assert.equal(events.routerProvider, null);
  await monitors.dispose();
  assert.equal(events.monitorProvider, null);
  assert.deepEqual((await events.managementSnapshot()).bundle_types, []);
  assert.equal(definitions.size, 0, "surviving Agent loses unloaded plugin tools");
  const reloaded = ctx.plugin(monitorPlugin, { pollIntervalMs: 60_000 });
  await reloaded;
  await eventually(() => events.monitorProvider);
  assert.equal(definitions.size, 6);
  await first.dispose();
  await eventually(() => definitions.size === 0);
  const second = ctx.plugin(host);
  await second;
  await eventually(() => events.monitorProvider);
  assert.equal(definitions.size, 6, "dependency reload attaches exactly once");
  await reloaded.dispose();
  await second.dispose();
});

async function eventually(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(predicate(), "Cordis state did not settle");
}
