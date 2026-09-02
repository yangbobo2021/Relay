import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import { Context } from "@deepseek-ai/cordis";

import { RelayEventsService } from "../../integrations/events/events-service.js";
import { createSinglePassSemanticRouter } from "../../integrations/semantic-router/index.mjs";
import { RelayMonitorsController } from "../../integrations/monitors/src/controller.mjs";
import { RelayMonitorObserverRegistry } from "../../integrations/monitors/src/observer-registry.mjs";
import { createGitHubPullRequestObserver } from "../../integrations/github/src/observer.mjs";
import { createGitHubWebhookHandler } from "../../integrations/github/src/webhook.mjs";
import { createPullRequestWatchProposal } from "../../integrations/github/src/workflow.mjs";
import { GmailConnector } from "../../integrations/email/src/connector.mjs";
import { EmailCursorStore } from "../../integrations/email/src/cursor-store.mjs";

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

test("EP13-004/006/007: timer reconciles backward/forward clocks and delivers timeout continuation once", async t => {
  let now = new Date("2026-08-30T00:00:00.000Z");
  const f = await fixture(t, { clock: () => new Date(now) });
  const proposal = f.monitors.createTimer({
    sessionId: "timer-clock-owner", afterSeconds: 10, resumePrompt: "Report the timeout without claiming approval.",
    now, idFactory: () => "clock-movement",
  });
  await f.events.registerWaits(proposal);
  assert.equal(f.events.inspectMonitor(proposal.timer.timer_id).next_check_at, "2026-08-30T00:00:10.000Z");

  now = new Date("2026-08-29T23:59:00.000Z");
  assert.deepEqual(await f.monitors.runtime.runDue(), [], "backward clock movement must not fire early");
  now = new Date("2026-08-30T00:00:10.000Z");
  const [due] = await f.monitors.runtime.runDue();
  assert.equal(due.status, "triggered");
  assert.equal(f.accepted.length, 1);
  assert.equal(f.accepted[0].deliveries[0].event.type, "timer.elapsed");
  assert.equal(f.accepted[0].deliveries[0].matched_waits[0].continuation.on_timeout,
    "Report the timeout without claiming approval.");
  assert.equal(f.accepted[0].deliveries[0].event.data.deadline, "2026-08-30T00:00:10.000Z");

  now = new Date("2026-08-31T00:00:00.000Z");
  assert.deepEqual(await f.monitors.runtime.runDue(), []);
  assert.equal(f.accepted.length, 1, "forward reconciliation after commit must not double fire");
});

test("EP13-005: timer deadline update and cancel/check races have one serializable outcome", async t => {
  let now = new Date("2026-08-30T00:00:00.000Z");
  const f = await fixture(t, { clock: () => new Date(now) });
  const proposal = f.monitors.createTimer({
    sessionId: "timer-race-owner", afterSeconds: 10, resumePrompt: "continue", now, idFactory: () => "race-timer",
  });
  await f.events.registerWaits(proposal);

  now = new Date("2026-08-30T00:00:05.000Z");
  const updatedDeadline = "2026-08-30T00:00:20.000Z";
  const before = f.events.inspectMonitor(proposal.timer.timer_id);
  const updated = await f.events.rebaselineMonitor(proposal.timer.timer_id, {
    monitor_id: proposal.timer.timer_id,
    wait_id: proposal.timer.wait_id,
    detector: { ...before.detector, deadline: updatedDeadline },
    observer: before.observer,
    artifact: before.artifact,
    schedule: { interval_seconds: 15, jitter_seconds: 0 },
    capabilities: before.capabilities,
  }, { expectedVersion: before.version });
  assert.equal(updated.detector.deadline, updatedDeadline);
  now = new Date("2026-08-30T00:00:10.000Z");
  assert.deepEqual(await f.monitors.runtime.runDue(), [], "successfully updated old deadline must never fire");

  now = new Date(updatedDeadline);
  const snapshot = f.events.beginMonitorCheck(proposal.timer.timer_id, "timer-race-worker", 60_000, { force: true });
  assert.equal(snapshot.status, "started");
  assert.throws(() => f.events.stopMonitor(proposal.timer.timer_id, { expectedVersion: snapshot.monitor.version }), /busy/);
  await assert.rejects(f.events.rebaselineMonitor(proposal.timer.timer_id, {
    monitor_id: proposal.timer.timer_id,
    wait_id: proposal.timer.wait_id,
    detector: { ...snapshot.monitor.detector, deadline: "2026-08-30T00:00:30.000Z" },
    observer: snapshot.monitor.observer,
    artifact: snapshot.monitor.artifact,
    schedule: snapshot.monitor.schedule,
    capabilities: snapshot.monitor.capabilities,
  }), /busy/);
  const completed = f.events.completeMonitorCheck(snapshot, "timer-race-worker", { observed_at: now.toISOString() }, [{
    type: "timer.elapsed", key: `${proposal.timer.timer_id}:${updatedDeadline}`,
    data: { deadline: updatedDeadline, observed_at: now.toISOString(), resume_prompt: "continue" },
  }]);
  assert.equal(completed.status, "triggered");
  await f.events.dispatchSession("timer-race-owner");
  assert.equal(f.accepted.length, 1);
  assert.throws(() => f.events.stopMonitor(proposal.timer.timer_id), /already terminal/);
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

test("EP05/EP09: GitHub workflow baselines then emits one changed PR snapshot into the same Session", async t => {
  const f = await fixture(t);
  let conclusion = null;
  const apiClient = { async getPullRequestSnapshot() {
    return {
      head_sha: "sha-1", state: "open", merged: false, draft: false, mergeable: true,
      checks: [{ id: "check-1", name: "test", status: conclusion ? "completed" : "in_progress", conclusion }],
      reviews: [],
    };
  } };
  f.observers.register(createGitHubPullRequestObserver({ client: apiClient }));
  const proposal = createPullRequestWatchProposal({
    sessionId: "github-owner",
    pullRequest: "octo/relay#42",
    taskSummary: "Wait for PR status",
    cadenceSeconds: 60,
    idFactory: () => "composition",
  });
  const stored = await f.events.registerWaits(proposal);
  assert.equal(stored.monitors[0].state, "active");
  assert.equal(f.accepted.length, 0);
  conclusion = "failure";
  const changed = await f.events.checkMonitor("github-pr-composition", { force: true });
  assert.equal(changed.status, "triggered");
  assert.equal(f.accepted.length, 1);
  assert.equal(f.accepted[0].sessionId, "github-owner");
  assert.equal(f.accepted[0].deliveries[0].event.type, "github.pull_request.transition");
  assert.equal(f.accepted[0].deliveries[0].event.correlation_key,
    "github:octo/relay#42@sha-1:check_run:check-1:failure");
  assert.equal(f.accepted[0].deliveries[0].matched_waits[0].continuation.artifacts[0].id, "octo/relay#42");
  assert.equal((await f.events.checkMonitor("github-pr-composition", { force: true })).status, "inactive");
  const source = f.events.registerBoundEventSource({ id: "acceptance.github.convergence", sources: ["github"] });
  t.after(() => source.dispose());
  const handler = createGitHubWebhookHandler({
    relayEvents: f.events,
    boundSource: source,
    webhookSecrets: "0123456789abcdef0123456789abcdef",
  });
  const webhook = responseRecorder();
  await handler(githubRequest({
    action: "completed",
    repository: { full_name: "Octo/Relay" },
    check_run: { id: "check-1", head_sha: "sha-1", conclusion: "failure", pull_requests: [{ number: 42, head: { sha: "sha-1" } }] },
  }), webhook);
  assert.equal(webhook.status, 202);
  assert.equal(webhook.json.duplicate, true);
  assert.equal(f.accepted.length, 1);
});

test("EP05-010: webhook racing an active poll lease converges to one Event and one Delivery", async t => {
  const f = await fixture(t);
  let calls = 0;
  let entered;
  let release;
  const pollEntered = new Promise(resolve => { entered = resolve; });
  const pollRelease = new Promise(resolve => { release = resolve; });
  f.observers.register(createGitHubPullRequestObserver({ client: { async getPullRequestSnapshot() {
    calls += 1;
    if (calls > 1) { entered(); await pollRelease; }
    return {
      head_sha: "sha-race", state: "open", merged: false, draft: false, mergeable: true,
      checks: [{ id: "check-race", name: "test", status: calls > 1 ? "completed" : "in_progress", conclusion: calls > 1 ? "failure" : null }],
      reviews: [],
    };
  } } }));
  const proposal = createPullRequestWatchProposal({
    sessionId: "github-race-owner", pullRequest: "octo/relay#42", taskSummary: "Race acceptance",
    cadenceSeconds: 60, idFactory: () => "race",
  });
  await f.events.registerWaits(proposal);
  const poll = f.events.checkMonitor("github-pr-race", { force: true });
  await pollEntered;

  const source = f.events.registerBoundEventSource({ id: "acceptance.github.race", sources: ["github"] });
  t.after(() => source.dispose());
  const handler = createGitHubWebhookHandler({ relayEvents: f.events, boundSource: source,
    webhookSecrets: "0123456789abcdef0123456789abcdef" });
  const response = responseRecorder();
  await handler(githubRequest({
    action: "completed", repository: { full_name: "Octo/Relay" },
    check_run: { id: "check-race", head_sha: "sha-race", conclusion: "failure", pull_requests: [{ number: 42, head: { sha: "sha-race" } }] },
  }), response);
  assert.equal(response.status, 202);
  assert.equal(f.accepted.length, 1);
  release();
  const converged = await poll;
  assert.equal(converged.status, "converged");
  assert.equal(f.accepted.length, 1);
  assert.equal(f.events.store.database.prepare("SELECT COUNT(*) AS count FROM events").get().count, 1);
  assert.equal(f.events.store.database.prepare("SELECT COUNT(*) AS count FROM deliveries").get().count, 1);
  assert.equal(f.events.store.database.prepare("SELECT COUNT(*) AS count FROM monitor_triggers").get().count, 1);
  assert.equal(f.events.inspectMonitor("github-pr-race").state, "completed");
});

test("EP04: signed GitHub webhook uses real trusted Events binding and conflicting replay fails closed", async t => {
  const f = await fixture(t);
  const proposal = registration("github-webhook-owner", "github.pull_request.transition");
  proposal.waits[0].continuation = {
    artifacts: [{ kind: "github_pull_request", id: "octo/relay#42" }],
  };
  await f.events.registerWaits(proposal);
  const capability = f.events.registerBoundEventSource({ id: "acceptance.github", sources: ["github"] });
  t.after(() => capability.dispose());
  const handler = createGitHubWebhookHandler({
    relayEvents: f.events,
    boundSource: capability,
    webhookSecrets: "0123456789abcdef0123456789abcdef",
  });
  const body = {
    action: "completed",
    repository: { full_name: "Octo/Relay" },
    check_run: { id: 9, head_sha: "sha-1", conclusion: "failure", pull_requests: [{ number: 42, head: { sha: "sha-1" } }] },
  };
  const accepted = responseRecorder();
  await handler(githubRequest(body), accepted);
  assert.equal(accepted.status, 202);
  assert.equal(accepted.json.disposition, "deliver");
  assert.equal(f.accepted.length, 1);
  assert.equal(f.accepted[0].sessionId, "github-webhook-owner");
  assert.match(f.accepted[0].deliveries[0].relation, /validated binding/u);

  const duplicate = responseRecorder();
  await handler(githubRequest(body), duplicate);
  assert.equal(duplicate.status, 202);
  assert.equal(duplicate.json.duplicate, true);
  assert.equal(f.accepted.length, 1);

  const conflict = responseRecorder();
  await handler(githubRequest({ ...body, action: "rerequested" }), conflict);
  assert.equal(conflict.status, 409);
  assert.equal(f.accepted.length, 1);
});

test("EP15: Gmail history cursor binds a correlated reply to the existing Session exactly once", async t => {
  const f = await fixture(t);
  const proposal = registration("email-owner", "email.received");
  proposal.waits[0].continuation = {
    next_action: "Continue the customer response.",
    artifacts: [{ kind: "email_thread", id: "gmail:agent@example.test:thread-1" }],
  };
  await f.events.registerWaits(proposal);
  const source = f.events.registerBoundEventSource({ id: "acceptance.gmail", sources: ["gmail"] });
  const cursorStore = new EmailCursorStore(":memory:");
  t.after(() => { source.dispose(); cursorStore.close(); });
  const connector = new GmailConnector({
    relayEvents: f.events,
    boundSource: source,
    cursorStore,
    client: {
      async listHistory() { return { cursor: "11", messageIds: ["message-1"] }; },
      async getMessage() {
        return {
          id: "message-1", threadId: "thread-1", internalDate: "1788048000000",
          payload: {
            mimeType: "text/plain",
            headers: [{ name: "From", value: "buyer@example.test" }, { name: "Subject", value: "Approved" }],
            body: { data: Buffer.from("The proposal is approved.").toString("base64url") },
          },
        };
      },
    },
  });
  await connector.sync({ account: "agent@example.test", notifiedCursor: "10" });
  assert.equal(f.accepted.length, 0);
  await connector.sync({ account: "agent@example.test", notifiedCursor: "11" });
  assert.equal(f.accepted.length, 1);
  assert.equal(f.accepted[0].sessionId, "email-owner");
  assert.equal(f.accepted[0].deliveries[0].event.type, "email.received");
  assert.equal(f.accepted[0].deliveries[0].matched_waits[0].continuation.next_action, "Continue the customer response.");
  assert.equal(cursorStore.get("agent@example.test").cursor, "11");
  await connector.sync({ account: "agent@example.test", notifiedCursor: "11" });
  assert.equal(f.accepted.length, 1);
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

function githubRequest(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const request = Readable.from([body]);
  request.method = "POST";
  request.headers = {
    "content-type": "application/json",
    "content-length": String(body.length),
    "x-github-event": "check_run",
    "x-github-delivery": "composition-delivery",
    "x-hub-signature-256": `sha256=${createHmac("sha256", "0123456789abcdef0123456789abcdef").update(body).digest("hex")}`,
  };
  return request;
}

function responseRecorder() {
  return {
    status: null,
    json: null,
    writeHead(status) { this.status = status; },
    end(body) { this.json = JSON.parse(body); },
  };
}
