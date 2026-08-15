import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { validateRoutingDecision } from "../../event-router/decision.mjs";

export class RelayRuntime {
  constructor({
    store,
    router,
    inbox,
    monitorRegistrar = null,
    workerId = `relay-dispatcher-${randomUUID()}`,
    leaseMs = 60_000,
    maxDispatchBatches = 100,
  }) {
    assert.ok(store, "store is required");
    assert.equal(typeof router?.route, "function", "router.route is required");
    assert.equal(typeof inbox?.deliver, "function", "inbox.deliver is required");
    if (monitorRegistrar != null) {
      assert.equal(typeof monitorRegistrar.prepare, "function", "monitorRegistrar.prepare is required");
    }
    this.store = store;
    this.router = router;
    this.inbox = inbox;
    this.monitorRegistrar = monitorRegistrar;
    this.workerId = workerId;
    this.leaseMs = leaseMs;
    this.maxDispatchBatches = maxDispatchBatches;
  }

  async registerWaits({
    sessionId,
    taskSummary,
    context = {},
    waits,
    monitors = [],
    monitorRearms = [],
  }) {
    validateWaitRegistration({ sessionId, taskSummary, context, waits, monitors, monitorRearms });
    let preparedMonitors = monitors;
    if (monitors.length > 0) {
      assert.ok(this.monitorRegistrar, "monitor proposals require a monitorRegistrar");
      preparedMonitors = await this.monitorRegistrar.prepare({ waits, monitors });
    }
    return this.store.registerWaits({
      sessionId,
      taskSummary,
      context,
      waits,
      monitors: preparedMonitors,
      monitorRearms,
    });
  }

  cancelWaits(sessionId) {
    return this.store.cancelWaits(sessionId);
  }

  listWaits() {
    return this.store.listWaitRegistrations();
  }

  async handleEvent(eventInput) {
    validateEventInput(eventInput);
    const ingestion = this.store.ingestEvent(eventInput);
    const eventId = ingestion.event.event_id;
    let currentEvent = this.store.inspectEvent(eventId);
    let sessionIds = [];

    if (currentEvent.state === "received" || currentEvent.state === "routing") {
      const routing = await this.routeEvent(eventId);
      sessionIds = routing.sessionIds;
    } else if (currentEvent.state === "dispatched") {
      sessionIds = [...new Set(currentEvent.deliveries
        .filter((delivery) => delivery.state === "queued")
        .map((delivery) => delivery.session_id))];
    }

    const dispatchResults = await Promise.all(
      sessionIds.map((sessionId) => this.dispatchSession(sessionId)),
    );
    currentEvent = this.store.inspectEvent(eventId);
    return {
      duplicate: ingestion.duplicate,
      event: currentEvent,
      registrations: sessionIds.map((sessionId) => this.store.inspectWaitRegistration(sessionId)),
      dispatchResults,
    };
  }

  async routeEvent(eventId) {
    const snapshot = this.store.beginRouting(eventId);
    if (snapshot.alreadyRouted) return snapshot.result;

    let routed;
    try {
      routed = await this.router.route({
        event: snapshot.event.payload,
        eventRecord: snapshot.event,
        sessions: snapshot.sessions,
      });
      const decision = routed?.decision ?? routed;
      validateRoutingDecision({
        decision,
        sessions: snapshot.sessions,
        label: `event ${eventId}`,
      });
      this.store.recordRoutingAttempt({
        eventId,
        router: this.router.name ?? "anonymous-router",
        model: this.router.model ?? null,
        output: decision,
        usage: routed?.telemetry ?? null,
      });
      return this.store.commitRouting(snapshot, decision);
    } catch (error) {
      this.store.recordRoutingAttempt({
        eventId,
        router: this.router.name ?? "anonymous-router",
        model: this.router.model ?? null,
        output: routed?.decision ?? routed ?? null,
        error: error.stack ?? error.message,
      });
      throw error;
    }
  }

  async dispatchSession(sessionId) {
    const activationIds = [];
    let registration = this.store.inspectWaitRegistration(sessionId);
    for (let index = 0; index < this.maxDispatchBatches; index += 1) {
      const started = this.store.beginDispatch(sessionId, this.workerId, this.leaseMs);
      if (started.status !== "started") {
        return activationIds.length === 0
          ? started
          : {
              status: "accepted",
              activationId: activationIds.at(-1),
              activationIds,
              registration,
            };
      }

      try {
        await this.inbox.deliver({
          sessionId,
          activationId: started.activation.activation_id,
          deliveries: started.deliveries,
        });
        registration = this.store.completeDispatch(
          sessionId,
          started.activation.activation_id,
          this.workerId,
        );
        activationIds.push(started.activation.activation_id);
      } catch (error) {
        this.store.failDispatch(
          sessionId,
          started.activation.activation_id,
          this.workerId,
          error.stack ?? error.message,
        );
        return {
          status: "retry",
          activationId: started.activation.activation_id,
          activationIds,
          error: error.stack ?? error.message,
        };
      }
    }
    throw new Error(`session ${sessionId} exceeded ${this.maxDispatchBatches} dispatch batches`);
  }
}

export function validateWaitRegistration({
  sessionId,
  taskSummary,
  context,
  waits,
  monitors = [],
  monitorRearms = [],
}) {
  assert.equal(typeof sessionId, "string", "DSH session id is required");
  assert.equal(typeof taskSummary, "string", "task summary is required");
  assert.ok(context && typeof context === "object" && !Array.isArray(context), "context must be an object");
  assert.ok(Array.isArray(waits) && waits.length > 0, "at least one wait is required");
  const waitIds = waits.map((wait) => wait.wait_id).filter(Boolean);
  assert.equal(new Set(waitIds).size, waitIds.length, "wait IDs must be unique");
  for (const wait of waits) {
    assert.equal(typeof wait.phase, "string", "wait phase is required");
    assert.equal(typeof wait.exclusive, "boolean", "wait exclusive must be boolean");
    assert.equal(typeof wait.expected_event, "string", "wait expected_event is required");
    assert.equal(typeof wait.caused_by, "string", "wait caused_by is required");
    assert.ok(Array.isArray(wait.actors), "wait actors must be an array");
    assert.ok(Array.isArray(wait.entities), "wait entities must be an array");
    assert.equal(typeof wait.prior_exchange, "string", "wait prior_exchange is required");
  }
  assert.ok(Array.isArray(monitors), "monitors must be an array");
  const monitorIds = monitors.map((monitor) => monitor.monitor_id);
  assert.equal(new Set(monitorIds).size, monitorIds.length, "monitor IDs must be unique");
  for (const monitor of monitors) {
    assert.equal(typeof monitor.monitor_id, "string", "monitor_id is required");
    assert.ok(waitIds.includes(monitor.wait_id), `monitor wait ${monitor.wait_id} is not proposed`);
    assert.ok(
      monitor.lifecycle === "one_shot" || monitor.lifecycle === "recurring",
      `monitor ${monitor.monitor_id} lifecycle is invalid`,
    );
    assert.ok(monitor.detector && typeof monitor.detector === "object", "monitor detector is required");
  }
  assert.ok(Array.isArray(monitorRearms), "monitorRearms must be an array");
  const rearmIds = monitorRearms.map((rearm) => rearm.monitor_id);
  assert.equal(new Set(rearmIds).size, rearmIds.length, "monitor rearm IDs must be unique");
  for (const rearm of monitorRearms) {
    assert.ok(waitIds.includes(rearm.wait_id), `monitor rearm wait ${rearm.wait_id} is not proposed`);
  }
  return { sessionId, taskSummary, context, waits, monitors, monitorRearms };
}

function validateEventInput(input) {
  assert.ok(input && typeof input === "object", "event input is required");
  assert.equal(typeof input.source, "string", "event source is required");
  assert.equal(typeof input.fingerprint, "string", "event fingerprint is required");
}
