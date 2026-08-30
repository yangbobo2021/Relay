import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Context } from "@deepseek-ai/cordis";

import { RelayEventsService } from "../../integrations/events/events-service.js";
import { createSinglePassSemanticRouter } from "../../integrations/semantic-router/index.mjs";
import { RelayMonitorsController } from "../../integrations/monitors/src/controller.mjs";
import { RelayMonitorObserverRegistry } from "../../integrations/monitors/src/observer-registry.mjs";

test("Events accepts the real Semantic Router provider and records its routed delivery", async () => {
  const accepted = [];
  const events = createEvents({ async deliver(input) { accepted.push(input); } });
  try {
    await events.registerWaits(registration("session-semantic", "customer.replied"));
    const router = createSinglePassSemanticRouter({
      maxAttempts: 1,
      adapter: {
        model: "acceptance-model",
        async call() {
          return {
            output: decision("session-semantic", "wait-session-semantic"),
            telemetry: { model_calls: 1, input_tokens: 10, cached_input_tokens: 0, output_tokens: 5, latency_ms: 1 },
          };
        },
      },
    });
    const release = events.registerRouter(router);

    const result = await events.handleEvent({
      event_id: "event-semantic-composition",
      source: "acceptance",
      fingerprint: "event-semantic-composition",
      type: "provider.message",
      body: "The customer accepted the proposal.",
    });

    assert.equal(result.event.decision.disposition, "deliver");
    assert.equal(result.event.routing_attempts[0].router, "semantic-single-pass");
    assert.equal(result.event.routing_attempts[0].usage.model_calls, 1);
    assert.equal(accepted.length, 1);
    assert.equal(accepted[0].sessionId, "session-semantic");

    release();
    assert.equal(events.routerProvider, null);
    assert.equal(events.router.id, "relay.exact-event-type");
  } finally {
    await events.stop();
  }
});

test("Monitors registers a timer atomically through Events and delivers one bound trigger", async () => {
  let now = new Date("2026-08-30T00:00:00.000Z");
  const accepted = [];
  const ctx = new Context();
  const events = createEvents({ async deliver(input) { accepted.push(input); } }, { clock: () => new Date(now) });
  const observers = new RelayMonitorObserverRegistry(ctx, { clock: () => new Date(now) });
  const monitors = new RelayMonitorsController({ events, observers, pollIntervalMs: 60_000 });
  const release = events.registerMonitorProvider(monitors.provider);
  try {
    const proposal = monitors.createTimer({
      sessionId: "session-timer",
      afterSeconds: 1,
      resumePrompt: "Continue the delivery check.",
      now,
      idFactory: () => "acceptance",
    });
    const stored = await events.registerWaits(proposal);
    assert.equal(stored.monitors.length, 1);
    assert.equal(stored.monitors[0].state, "active");

    now = new Date("2026-08-30T00:00:02.000Z");
    const triggered = await events.checkMonitor(proposal.timer.timer_id, { force: true });
    assert.equal(triggered.status, "triggered");
    assert.equal(triggered.monitor.state, "completed");
    assert.equal(accepted.length, 1);
    assert.equal(accepted[0].sessionId, "session-timer");
    assert.equal(accepted[0].deliveries[0].event.type, "timer.elapsed");

    const duplicate = await events.checkMonitor(proposal.timer.timer_id, { force: true });
    assert.equal(duplicate.status, "inactive");
    assert.equal(accepted.length, 1);
  } finally {
    release();
    await monitors.stop();
    await events.stop();
    await ctx.fiber.dispose();
  }
});

function createEvents(inbox, options = {}) {
  return new RelayEventsService(new Context(), {
    databasePath: ":memory:",
    dispatchPollIntervalMs: 60_000,
    inbox,
    ...options,
  });
}

async function fixture(t, options = {}) {
  const accepted = [];
  const ctx = new Context();
  const events = createEvents({ async deliver(input) { accepted.push(input); } }, options);
  const observers = new RelayMonitorObserverRegistry(ctx);
  const monitors = new RelayMonitorsController({ events, observers, pollIntervalMs: 60_000 });
  const release = events.registerMonitorProvider(monitors.provider);
  t.after(async () => { release(); await monitors.stop(); await events.stop(); await ctx.fiber.dispose(); });
  return { accepted, events, observers, monitors };
}

function monitored(id = "owner", lifecycle = "one_shot") {
  return { ...registration(id, "approved"), monitors: [{
    monitor_id: `monitor-${id}`, wait_id: `wait-${id}`, lifecycle,
    observer: { provider: "fixture" }, artifact: { kind: "trusted-provider" },
    detector: { kind: "field_transition", field: "status", to: "approved", event_type: "approved" },
    schedule: { interval_seconds: 1 }, retry: { degraded_after: 1, fail_after: 2 },
  }] };
}

test("MON-006/009: a trusted observer survives persistence and emits one bound transition", async t => {
  const f = await fixture(t);
  let status = "pending";
  f.observers.register({ id: "fixture", async observe() { return { id: "order", status }; } });
  await f.events.registerWaits(monitored());
  assert.equal(f.events.listWaits()[0].monitors[0].observer.provider, "fixture");
  status = "approved";
  const result = await f.events.checkMonitor("monitor-owner", { force: true });
  assert.equal(result.status, "triggered");
  assert.equal(f.accepted.length, 1);
  assert.equal((await f.events.checkMonitor("monitor-owner", { force: true })).status, "inactive");
});

test("EVT-008/MON-011: failed/missing baselines preserve existing Waits and Monitors atomically", async t => {
  const f = await fixture(t);
  await f.events.registerWaits(registration("owner", "old"));
  await assert.rejects(f.events.registerWaits(monitored()), /not registered/);
  f.observers.register({ id: "fixture", async observe() { throw new Error("baseline failed"); } });
  await assert.rejects(f.events.registerWaits(monitored()), /baseline failed/);
  const state = f.events.listWaits()[0];
  assert.equal(state.waits[0].expected_event, "old");
  assert.equal(state.waits[0].status, "active");
  assert.equal(state.monitors.length, 0);
});

test("MON-010: repeated observer failures degrade then send one failure Event without claiming the business Wait", async t => {
  const f = await fixture(t);
  f.observers.register({ id: "fixture", async observe({ phase }) {
    if (phase === "baseline") return { id: "order", status: "pending" };
    throw new Error("fixture offline");
  } });
  await f.events.registerWaits(monitored());
  const first = await f.events.checkMonitor("monitor-owner", { force: true });
  assert.equal(first.monitor.state, "degraded");
  const second = await f.events.checkMonitor("monitor-owner", { force: true });
  assert.equal(second.monitor.state, "failed");
  assert.equal(f.accepted.length, 1);
  assert.equal(f.accepted[0].deliveries[0].event.type, "monitor.failed");
  assert.equal(f.events.listWaits()[0].waits.find(wait => wait.wait_id === "wait-owner").status, "active");
  await f.events.checkMonitor("monitor-owner", { force: true });
  assert.equal(f.accepted.length, 1);
});

test("MON-013: concurrent checks acquire only one lease", async t => {
  const f = await fixture(t);
  let resolve, entered;
  const blocked = new Promise(r => { resolve = r; });
  const began = new Promise(r => { entered = r; });
  f.observers.register({ id: "fixture", async observe({ phase }) {
    if (phase === "baseline") return { status: "pending" };
    entered(); return blocked;
  } });
  await f.events.registerWaits(monitored());
  const one = f.events.checkMonitor("monitor-owner", { force: true });
  await began;
  try { assert.equal((await f.events.checkMonitor("monitor-owner", { force: true })).status, "busy"); }
  finally { resolve({ status: "approved" }); }
  assert.equal((await one).status, "triggered");
  assert.equal(f.accepted.length, 1);
});

test("MON-007/008: recurring unseen-item Monitor pauses, rearms and does not replay an old identity", async t => {
  const f = await fixture(t);
  let ids = [];
  f.observers.register({ id: "fixture", async observe() { return { ids }; } });
  const proposal = monitored("owner", "recurring");
  proposal.monitors[0].detector = { kind: "unseen_items", identity_field: "ids", event_type: "approved" };
  await f.events.registerWaits(proposal);
  ids = ["first"];
  await f.events.checkMonitor("monitor-owner", { force: true });
  assert.equal(f.events.listWaits()[0].monitors[0].state, "triggered");
  const next = registration("owner", "approved");
  next.waits[0].wait_id = "wait-rearmed";
  await f.events.registerWaits({ ...next, monitorRearms: [{ monitor_id: "monitor-owner", wait_id: "wait-rearmed" }] });
  assert.equal((await f.events.checkMonitor("monitor-owner", { force: true })).status, "observed");
  ids = ["first", "second"];
  assert.equal((await f.events.checkMonitor("monitor-owner", { force: true })).status, "triggered");
  assert.equal(f.accepted.length, 2);
  assert.deepEqual(f.accepted.map(x => x.deliveries[0].event.data.item_id), ["first", "second"]);
});

test("MON-004: an overdue timer is recovered from SQLite after controller and Events restart", async t => {
  const directory = await mkdtemp(join(tmpdir(), "relay-monitor-restart-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = new Date("2026-08-30T00:00:00Z");
  const options = { databasePath: join(directory, "events.sqlite"), clock: () => now };
  const first = await fixture(t, options);
  const proposal = first.monitors.createTimer({ sessionId: "timer-owner", afterSeconds: 1, resumePrompt: "continue", now });
  await first.events.registerWaits(proposal);
  await first.monitors.stop(); await first.events.stop();
  now = new Date("2026-08-30T00:00:02Z");
  const second = await fixture(t, options);
  await second.monitors.runtime.runDue();
  assert.equal(second.accepted.length, 1);
  assert.equal(second.accepted[0].sessionId, "timer-owner");
});

test("recurring rearm stays active when an old trigger identity disappears and reappears", async t => {
  const f = await fixture(t);
  let status = "pending";
  f.observers.register({ id: "fixture", async observe() { return { id: "order", status }; } });
  await f.events.registerWaits(monitored("owner", "recurring"));
  status = "approved";
  await f.events.checkMonitor("monitor-owner", { force: true });
  const replacement = registration("owner", "approved");
  replacement.waits[0].wait_id = "next-wait";
  await f.events.registerWaits({ ...replacement, monitorRearms: [{ monitor_id: "monitor-owner", wait_id: "next-wait" }] });
  status = "pending";
  await f.events.checkMonitor("monitor-owner", { force: true });
  status = "approved";
  const replay = await f.events.checkMonitor("monitor-owner", { force: true });
  assert.equal(replay.status, "observed");
  assert.equal(replay.monitor.state, "active");
  assert.equal(f.accepted.length, 1);
  assert.equal(f.events.listWaits()[0].waits.find(wait => wait.wait_id === "next-wait").status, "active");
});

test("shutdown releases a running Monitor lease without consuming its Wait or failure budget", async t => {
  const f = await fixture(t);
  let entered;
  const began = new Promise(resolve => { entered = resolve; });
  f.observers.register({ id: "fixture", async observe({ phase }) {
    if (phase === "baseline") return { status: "pending" };
    entered(); return new Promise(() => {});
  } });
  await f.events.registerWaits(monitored());
  const check = f.events.checkMonitor("monitor-owner", { force: true });
  await began;
  await f.monitors.stop();
  const result = await check;
  assert.equal(result.status, "aborted");
  assert.equal(result.monitor.state, "active");
  assert.equal(result.monitor.consecutive_failures, 0);
  assert.equal(result.monitor.lease_owner, null);
  assert.equal(f.accepted.length, 0);
});

function registration(sessionId, eventType) {
  return {
    sessionId,
    taskSummary: `Wait for ${eventType}`,
    waits: [{
      wait_id: `wait-${sessionId}`,
      phase: "waiting",
      exclusive: true,
      expected_event: eventType,
      caused_by: "acceptance test",
      actors: [],
      entities: [],
      prior_exchange: "Continue when the matching event arrives.",
    }],
  };
}

function decision(sessionId, waitId) {
  return {
    disposition: "deliver",
    actionable: true,
    deliveries: [{ session_id: sessionId, wait_ids: [waitId], relation: "semantic acceptance", confidence: 0.99 }],
    evidence: ["acceptance fixture"],
    summary: "Deliver the event to its existing waiting Session.",
  };
}
