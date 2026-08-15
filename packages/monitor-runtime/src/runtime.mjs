import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { detectMonitorEvents } from "./detectors.mjs";

export class MonitorRuntime {
  constructor({
    store,
    observer,
    relayRuntime = null,
    workerId = `monitor-worker-${randomUUID()}`,
    leaseMs = 60_000,
  } = {}) {
    assert.ok(store, "MonitorRuntime store is required");
    assert.equal(typeof observer?.observe, "function", "MonitorRuntime observer.observe is required");
    if (relayRuntime != null) {
      assert.equal(typeof relayRuntime.dispatchSession, "function", "relayRuntime.dispatchSession is required");
    }
    this.store = store;
    this.observer = observer;
    this.relayRuntime = relayRuntime;
    this.workerId = workerId;
    this.leaseMs = leaseMs;
  }

  async checkMonitor(monitorId, { force = false } = {}) {
    const snapshot = this.store.beginMonitorCheck(
      monitorId,
      this.workerId,
      this.leaseMs,
      { force },
    );
    if (snapshot.status !== "started") {
      return snapshot;
    }

    let result;
    try {
      const observation = await this.observer.observe({
        monitor: snapshot.monitor,
        previous: snapshot.monitor.last_observation?.data ?? null,
      });
      const proposedEvents = detectMonitorEvents({
        monitor: snapshot.monitor,
        previous: snapshot.monitor.last_observation?.data ?? null,
        current: observation,
      });
      result = this.store.completeMonitorCheck(
        snapshot,
        this.workerId,
        observation,
        proposedEvents,
      );
    } catch (error) {
      result = this.store.failMonitorCheck(
        snapshot,
        this.workerId,
        error.errorClass ?? "source_unavailable",
        error.stack ?? error.message,
      );
    }

    const dispatchResults = [];
    if (this.relayRuntime) {
      for (const sessionId of result.sessionIds) {
        dispatchResults.push(await this.relayRuntime.dispatchSession(sessionId));
      }
    }
    return { ...result, dispatchResults };
  }

  async prepare({ waits, monitors }) {
    const waitIds = new Set(waits.map((wait) => wait.wait_id));
    const prepared = [];
    for (const proposal of monitors) {
      assert.ok(waitIds.has(proposal.wait_id), `monitor wait ${proposal.wait_id} is not proposed`);
      const monitor = {
        ...proposal,
        state: "validating",
        last_observation: null,
      };
      const baseline = await this.observer.observe({
        monitor,
        previous: null,
        phase: "baseline",
      });
      assert.ok(baseline && typeof baseline === "object", "monitor baseline must be an object");
      detectMonitorEvents({ monitor, previous: null, current: baseline });
      prepared.push({
        ...proposal,
        baseline_observation: baseline,
      });
    }
    return prepared;
  }

  async runDue({ at, limit = 100 } = {}) {
    const monitors = this.store.listDueMonitors(at, limit);
    const results = [];
    for (const monitor of monitors) {
      results.push(await this.checkMonitor(monitor.monitor_id));
    }
    return results;
  }
}

export class MonitorObservationError extends Error {
  constructor(errorClass, message) {
    super(message);
    this.name = "MonitorObservationError";
    this.errorClass = errorClass;
  }
}
