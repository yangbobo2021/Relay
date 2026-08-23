import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { createTimerWait, MonitorRuntime, TimerObserver } from "@relay/monitor-runtime";
import { definePlugin } from "@relay/plugin-sdk";
import { RelayRuntime, RelayStore } from "@relay/runtime";

export const EVENT_RUNTIME_PLUGIN_ID = "relay.event-runtime";
export const EVENTS_CAPABILITY = "relay.events.v1";
export const MONITORS_CAPABILITY = "relay.monitors.v1";

export function createEventRuntimePlugin(config = {}) {
  return definePlugin({
    manifest: {
      id: EVENT_RUNTIME_PLUGIN_ID,
      version: "1.0.0",
      provides: {
        [EVENTS_CAPABILITY]: "1.0.0",
        [MONITORS_CAPABILITY]: "1.0.0",
      },
      requires: { "relay.delivery.v1": "^1.0.0" },
      optional: { "relay.logging.v1": "^1.0.0" },
      permissions: ["filesystem:relay-database", "timer:schedule"],
    },
    activate({ capabilities, defer }) {
      const delivery = capabilities.require("relay.delivery.v1");
      const logger = capabilities.optional("relay.logging.v1") ?? console;
      const databasePath = resolveDatabasePath(config.databasePath);
      mkdirSync(dirname(databasePath), { recursive: true });
      const store = new RelayStore(databasePath);
      const operations = new OperationGate();
      let stopped = false;
      let timer = null;
      defer(async () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        await operations.stop();
        store.close();
      });
      const observer = config.observer ?? new TimerObserver();
      const registrar = new MonitorRuntime({
        store,
        observer,
        workerId: config.registrarWorkerId ?? "relay-monitor-registrar",
      });
      const runtime = new RelayRuntime({
        store,
        router: config.router ?? createExactEventRouter(),
        inbox: delivery,
        monitorRegistrar: registrar,
        workerId: config.dispatchWorkerId ?? "relay-event-dispatcher",
      });
      const worker = new MonitorRuntime({
        store,
        observer,
        relayRuntime: runtime,
        workerId: config.monitorWorkerId ?? "relay-monitor-worker",
      });

      const pollIntervalMs = positiveInteger(config.pollIntervalMs, 1_000);
      const drive = async () => {
        if (stopped) return;
        try {
          await operations.run(() => worker.runDue());
        } catch (error) {
          logger.error?.(`Relay monitor worker failed: ${error?.stack ?? error}`);
        } finally {
          if (!stopped) timer = setTimeout(drive, pollIntervalMs);
        }
      };
      timer = setTimeout(drive, 0);

      return {
        capabilities: {
          [EVENTS_CAPABILITY]: Object.freeze({
            registerWaits: guardOperation(operations, runtime, "registerWaits"),
            cancelWaits: guardOperation(operations, runtime, "cancelWaits"),
            listWaits: guardOperation(operations, runtime, "listWaits"),
            handleEvent: guardOperation(operations, runtime, "handleEvent"),
            dispatchSession: guardOperation(operations, runtime, "dispatchSession"),
          }),
          [MONITORS_CAPABILITY]: Object.freeze({
            checkMonitor: guardOperation(operations, worker, "checkMonitor"),
            runDue: guardOperation(operations, worker, "runDue"),
            createTimerWait: (...args) => operations.run(() => createTimerWait(...args)),
          }),
        },
      };
    },
  });
}

class OperationGate {
  constructor() {
    this.accepting = true;
    this.inFlight = new Set();
  }

  run(operation) {
    if (!this.accepting) throw new Error("Relay Event Runtime is shutting down");
    const result = operation();
    if (!result || typeof result.then !== "function") return result;
    const task = Promise.resolve(result);
    this.inFlight.add(task);
    void task.then(
      () => { this.inFlight.delete(task); },
      () => { this.inFlight.delete(task); },
    );
    return task;
  }

  async stop() {
    this.accepting = false;
    await Promise.allSettled([...this.inFlight]);
  }
}

function guardOperation(gate, target, method) {
  return (...args) => gate.run(() => target[method](...args));
}

export function createExactEventRouter() {
  return {
    name: "relay-exact-event-type",
    async route({ event, sessions }) {
      const eventType = event.type ?? event.event_type;
      const matches = sessions.flatMap((session) => session.waits
        .filter((wait) => wait.status === "active" && wait.expected_event === eventType)
        .map((wait) => ({ session, wait })));
      if (matches.length === 0) {
        return {
          disposition: "dismiss",
          actionable: false,
          deliveries: [],
          evidence: eventType ? [`No active wait expects ${eventType}.`] : ["Event has no type."],
          summary: "No exact Relay wait matched the event.",
        };
      }
      const exclusive = matches.find(({ wait }) => wait.exclusive);
      const selected = exclusive ? [exclusive] : matches;
      return {
        disposition: "deliver",
        actionable: true,
        deliveries: selected.map(({ session, wait }) => ({
          session_id: session.session_id,
          wait_ids: [wait.wait_id],
          relation: `event type ${eventType} matches the registered wait`,
          confidence: 1,
        })),
        evidence: [`Event type ${eventType} exactly matches ${selected.length} active wait(s).`],
        summary: `Deliver ${eventType} to its waiting session.`,
      };
    },
  };
}

function resolveDatabasePath(value) {
  const configured = value ?? process.env.RELAY_DATABASE_PATH;
  return configured ? resolve(configured) : join(homedir(), ".relay", "relay.sqlite");
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
