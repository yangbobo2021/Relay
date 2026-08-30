import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import * as monitorPlugin from "../../integrations/monitors/host-plugin.js";
import * as routerPlugin from "../../integrations/semantic-router/host-plugin.js";
import { RelayEventsService } from "../../integrations/events/events-service.js";

test("Cordis late Events activation, provider unload/reload and root-Agent tool cleanup", async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const definitions = new Map();
  const agent = { id: "fixture-session", ctx: { tools: { register(definition) {
    assert.equal(definitions.has(definition.name), false, "tool must have one owner");
    definitions.set(definition.name, definition);
    return () => definitions.delete(definition.name);
  } } } };
  ctx.provide("agents", { roots: () => [agent] });
  ctx.provide("tools", {});
  ctx.provide("llm", { async * stream() { throw new Error("no model needed for lifecycle check"); } });
  const monitors = ctx.plugin(monitorPlugin, { pollIntervalMs: 60_000 });
  const router = ctx.plugin(routerPlugin, { provider: "fixture", model: "fixture" });
  await monitors; await router;
  assert.equal(definitions.size, 0, "Monitors is parked without Events");
  let events;
  const host = { name: "test-events-service", apply(scope) {
    events = new RelayEventsService(scope, { databasePath: ":memory:", inbox: { async deliver() {} } });
    scope.effect(() => () => events.stop());
  } };
  const first = ctx.plugin(host);
  await first;
  await eventually(() => events.monitorProvider && events.routerProvider);
  assert.equal(definitions.has("relay_schedule_timer"), true);
  await router.dispose();
  assert.equal(events.routerProvider, null);
  await monitors.dispose();
  assert.equal(events.monitorProvider, null);
  assert.equal(definitions.size, 0, "surviving Agent loses unloaded plugin tools");
  const reloaded = ctx.plugin(monitorPlugin, { pollIntervalMs: 60_000 });
  await reloaded;
  await eventually(() => events.monitorProvider);
  assert.equal(definitions.size, 1);
  await first.dispose();
  await eventually(() => definitions.size === 0);
  const second = ctx.plugin(host);
  await second;
  await eventually(() => events.monitorProvider);
  assert.equal(definitions.size, 1, "dependency reload attaches exactly once");
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
