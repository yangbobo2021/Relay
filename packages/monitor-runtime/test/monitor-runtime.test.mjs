import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RelayRuntime, RelayStore } from "../../runtime/index.mjs";
import {
  createTimerWait,
  MonitorObservationError,
  MonitorRuntime,
  TimerObserver,
} from "../index.mjs";

const suite = JSON.parse(
  await readFile(new URL("../../../fixtures/trigger-monitoring/cases.json", import.meta.url), "utf8"),
);

test("a one-shot Monitor injects its bound event into the DSH inbox", async () => {
  const caseData = fixture("approval_status_transition");
  const clock = mutableClock();
  const store = new RelayStore(":memory:", { clock: clock.read });
  seedCase(store, caseData);
  const accepted = [];
  const relayRuntime = relayFor(store, accepted);
  const monitorRuntime = new MonitorRuntime({
    store,
    relayRuntime,
    observer: sequenceObserver(caseData.steps.map((step) => step.observation)),
    workerId: "monitor-worker-approval",
  });

  clock.advance(1_000);
  const result = await monitorRuntime.checkMonitor(caseData.monitor.monitor_id);

  assert.equal(result.status, "triggered");
  assert.equal(result.dispatchResults[0].status, "accepted");
  assert.equal(accepted.length, 1);
  const event = store.inspectEvent(result.eventIds[0]);
  assert.equal(event.payload.type, "procurement.approved");
  assert.equal(event.state, "resolved");
  assert.deepEqual(event.deliveries[0].wait_ids, [caseData.monitor.binding.wait_id]);
  assert.equal(store.inspectMonitor(caseData.monitor.monitor_id).state, "completed");
  assert.equal(store.inspectWaitRegistration(caseData.monitor.binding.session_id).waits[0].status, "consumed");
  store.close();
});

test("a recurring Monitor can be rearmed by the Agent's next wait registration", async () => {
  const caseData = fixture("new_collection_item");
  const clock = mutableClock();
  const store = new RelayStore(":memory:", { clock: clock.read });
  seedCase(store, caseData);
  const relayRuntime = relayFor(store, []);
  const observations = caseData.steps
    .filter((step) => step.operation === "check")
    .map((step) => step.observation);
  const monitorRuntime = new MonitorRuntime({
    store,
    relayRuntime,
    observer: sequenceObserver(observations),
    workerId: "monitor-worker-collection",
  });

  clock.advance(1_000);
  const first = await monitorRuntime.checkMonitor(caseData.monitor.monitor_id);
  assert.equal(first.status, "triggered");
  assert.equal(store.getMonitor(caseData.monitor.monitor_id).state, "triggered");

  // The Agent processes the injected event, then explicitly registers the next phase.
  // A triggered recurring monitor is rearmed rather than recreated.
  await relayRuntime.registerWaits({
    sessionId: caseData.monitor.binding.session_id,
    taskSummary: caseData.description,
    waits: [wait("wait-new-support-ticket-2")],
    monitorRearms: [{
      monitor_id: caseData.monitor.monitor_id,
      wait_id: "wait-new-support-ticket-2",
    }],
  });
  assert.equal(store.getMonitor(caseData.monitor.monitor_id).state, "active");
  assert.equal(store.getMonitor(caseData.monitor.monitor_id).wait_id, "wait-new-support-ticket-2");
  store.close();
});

test("a forced Monitor check runs before its scheduled time", async () => {
  const caseData = fixture("approval_status_transition");
  const clock = mutableClock();
  const store = new RelayStore(":memory:", { clock: clock.read });
  seedCase(store, caseData);
  const monitorRuntime = new MonitorRuntime({
    store,
    observer: sequenceObserver([caseData.steps[0].observation]),
    workerId: "monitor-worker-forced",
  });

  const deferred = await monitorRuntime.checkMonitor(caseData.monitor.monitor_id);
  assert.equal(deferred.status, "not_due");

  const forced = await monitorRuntime.checkMonitor(caseData.monitor.monitor_id, { force: true });
  assert.equal(forced.status, "triggered");
  assert.equal(store.inspectMonitor(caseData.monitor.monitor_id).state, "completed");
  store.close();
});

test("Monitor contract failures stay visible and do not consume the business wait", async () => {
  const caseData = fixture("page_contract_failure");
  const clock = mutableClock();
  const store = new RelayStore(":memory:", { clock: clock.read });
  seedCase(store, caseData);
  const errors = caseData.steps.map(
    (step) => new MonitorObservationError(step.error_class, "expected selector is missing"),
  );
  const monitorRuntime = new MonitorRuntime({
    store,
    observer: sequenceObserver(errors),
    workerId: "monitor-worker-contract-failure",
  });

  for (let index = 0; index < 3; index += 1) {
    clock.advance(1_000);
    await monitorRuntime.checkMonitor(caseData.monitor.monitor_id);
  }

  const monitor = store.inspectMonitor(caseData.monitor.monitor_id);
  assert.equal(monitor.state, "failed");
  assert.equal(monitor.triggers.length, 1);
  assert.equal(store.inspectWaitRegistration(caseData.monitor.binding.session_id).waits[0].status, "active");
  assert.equal(store.inspectEvent(monitor.triggers[0].event_id).state, "dispatched");
  store.close();
});

test("Agent wait registration validates a Monitor baseline before storing it", async () => {
  const clock = mutableClock();
  const store = new RelayStore(":memory:", { clock: clock.read });
  const observer = {
    async observe({ phase }) {
      return phase === "baseline"
        ? { request_id: "REQ-42", status: "pending" }
        : { request_id: "REQ-42", status: "approved" };
    },
  };
  const registrar = new MonitorRuntime({ store, observer, workerId: "monitor-registrar" });
  const accepted = [];
  const relayRuntime = relayFor(store, accepted, registrar);

  const registration = await relayRuntime.registerWaits({
    sessionId: "dsh-session-dynamic-monitor",
    taskSummary: "Wait for request approval.",
    waits: [wait("wait-dynamic-approval")],
    monitors: [{
      monitor_id: "monitor-dynamic-approval",
      wait_id: "wait-dynamic-approval",
      lifecycle: "one_shot",
      detector: {
        kind: "field_transition",
        field: "status",
        to: "approved",
        identity_field: "request_id",
        event_type: "request.approved",
      },
      schedule: { interval_seconds: 1 },
    }],
  });

  assert.equal(registration.monitors.length, 1);
  assert.deepEqual(store.inspectMonitor("monitor-dynamic-approval").observations[0].data, {
    request_id: "REQ-42",
    status: "pending",
  });

  clock.advance(1_000);
  const checker = new MonitorRuntime({
    store,
    observer,
    relayRuntime,
    workerId: "monitor-checker-dynamic",
  });
  const triggered = await checker.checkMonitor("monitor-dynamic-approval");
  assert.equal(triggered.dispatchResults[0].status, "accepted");
  assert.equal(accepted.length, 1);
  store.close();
});

test("a persisted one-shot timer wakes its bound DSH conversation after the deadline", async () => {
  const clock = mutableClock();
  const store = new RelayStore(":memory:", { clock: clock.read });
  const observer = new TimerObserver({ clock: clock.read });
  const accepted = [];
  const registrar = new MonitorRuntime({ store, observer, workerId: "timer-registrar" });
  const relayRuntime = relayFor(store, accepted, registrar);
  const proposal = createTimerWait({
    sessionId: "dsh-session-timer",
    afterSeconds: 3_600,
    resumePrompt: "Build the release artifact and report the result.",
    now: clock.read(),
    idFactory: () => "release-build",
  });

  const registration = await relayRuntime.registerWaits(proposal);
  assert.equal(registration.monitors[0].next_check_at, "2026-08-14T01:00:00.000Z");

  clock.advance(3_599_000);
  assert.deepEqual(await registrar.runDue(), []);

  clock.advance(1_000);
  const worker = new MonitorRuntime({
    store,
    observer,
    relayRuntime,
    workerId: "timer-worker",
  });
  const [triggered] = await worker.runDue();
  assert.equal(triggered.status, "triggered");
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].sessionId, "dsh-session-timer");
  assert.equal(accepted[0].deliveries[0].event.type, "timer.elapsed");
  assert.equal(
    accepted[0].deliveries[0].event.data.resume_prompt,
    "Build the release artifact and report the result.",
  );
  assert.equal(store.getMonitor("timer-release-build").state, "completed");
  store.close();
});

function relayFor(store, accepted, monitorRegistrar = null) {
  return new RelayRuntime({
    store,
    router: {
      async route() {
        throw new Error("bound Monitor events bypass semantic routing");
      },
    },
    inbox: {
      async deliver(input) {
        accepted.push(structuredClone(input));
      },
    },
    monitorRegistrar,
    workerId: "relay-monitor-test",
  });
}

function fixture(id) {
  return suite.cases.find((caseData) => caseData.id === id);
}

function seedCase(store, caseData) {
  store.registerWaits({
    sessionId: caseData.monitor.binding.session_id,
    taskSummary: caseData.description,
    waits: [wait(caseData.monitor.binding.wait_id)],
    monitors: [{
      monitor_id: caseData.monitor.monitor_id,
      wait_id: caseData.monitor.binding.wait_id,
      lifecycle: caseData.monitor.lifecycle,
      fire_on_initial_match: caseData.monitor.fire_on_initial_match,
      detector: caseData.monitor.detector,
      retry: caseData.monitor.retry,
      schedule: { interval_seconds: 1, jitter_seconds: 0 },
      baseline_observation: caseData.baseline,
    }],
  });
}

function sequenceObserver(values) {
  const queue = [...values];
  return {
    async observe() {
      assert.ok(queue.length > 0, "fixture observer is exhausted");
      const value = queue.shift();
      if (value instanceof Error) throw value;
      return value;
    },
  };
}

function wait(waitId) {
  return {
    wait_id: waitId,
    phase: "monitoring",
    exclusive: true,
    expected_event: "The bound Monitor condition occurs.",
    caused_by: "The Agent delegated observation to Relay.",
    actors: [],
    entities: [waitId],
    prior_exchange: "The DSH conversation is waiting for an external condition.",
  };
}

function mutableClock() {
  let value = new Date("2026-08-14T00:00:00.000Z");
  return {
    read: () => new Date(value),
    advance(milliseconds) {
      value = new Date(value.getTime() + milliseconds);
    },
  };
}
