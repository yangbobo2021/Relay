import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { createTimerWait, MonitorRuntime, TimerObserver } from "../../packages/monitor-runtime/index.mjs";
import { RelayRuntime, RelayStore } from "../../packages/runtime/index.mjs";
import { installRelayAgentBridge } from "./agent-bridge.js";
import { DshInboxAdapter } from "./inbox-adapter.js";
import { RelayManagementGateway } from "./management-gateway.js";

export const name = "relay-runtime-host";
export const inject = ["agents", "sessions", "sessionPersistence", "tools", "typert"];

export function apply(ctx, config = {}) {
  const databasePath = resolveDatabasePath(config.databasePath);
  mkdirSync(dirname(databasePath), { recursive: true });
  const store = new RelayStore(databasePath);
  const observer = new TimerObserver();
  const registrar = new MonitorRuntime({
    store,
    observer,
    workerId: "relay-timer-registrar",
  });

  const resolveAgent = createSharedAgentLookup(ctx);
  const inbox = new DshInboxAdapter({
    resolveAgent,
    debug: config.debug ?? false,
    async awaitDurable(agent) {
      await agent.whenIdle();
      await ctx.sessions.flush(agent.session);
    },
  });
  const relayRuntime = new RelayRuntime({
    store,
    router: {
      name: "relay-unconfigured-router",
      async route() {
        throw new Error("Relay semantic routing is not configured in the timer-only profile");
      },
    },
    inbox,
    monitorRegistrar: registrar,
    workerId: "relay-dsh-dispatcher",
  });
  const worker = new MonitorRuntime({
    store,
    observer,
    relayRuntime,
    workerId: "relay-timer-worker",
  });
  new RelayManagementGateway(ctx, { relayRuntime, monitorWorker: worker });

  const stopAgentCreated = ctx.on("agent/created", ({ agent }) => {
    if (!ctx.agents.roots().includes(agent)) return;
    installRelayAgentBridge(agent.ctx, {
      sessionId: agent.id,
      registerWaits: (input) => relayRuntime.registerWaits(input),
      cancelWaits: (sessionId) => relayRuntime.cancelWaits(sessionId),
      scheduleTimer: async (input) => {
        const proposal = createTimerWait(input);
        await relayRuntime.registerWaits(proposal);
        return proposal.timer;
      },
    });
  });

  let stopped = false;
  let timer = null;
  const pollIntervalMs = positiveInteger(config.pollIntervalMs, 1_000);
  const drive = async () => {
    if (stopped) return;
    try {
      await worker.runDue();
    } catch (error) {
      ctx.logger.error(`Relay timer worker failed: ${error?.stack ?? error}`);
    } finally {
      if (!stopped) timer = setTimeout(drive, pollIntervalMs);
    }
  };
  timer = setTimeout(drive, 0);

  ctx.effect(() => () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stopAgentCreated();
    store.close();
  }, "relay.runtimeHost()");
}

function createSharedAgentLookup(ctx) {
  const lookup = ctx.typert.lookups.get("agent");
  if (!lookup) {
    throw new Error("Relay requires DSH's configured shared Agent lookup");
  }
  return async (sessionId) => {
    try {
      const agent = await lookup.resolve(sessionId);
      return agent
        ? { agent }
        : { error: { message: `session ${sessionId} was not found` } };
    } catch (error) {
      return { error: { message: error?.message ?? String(error) } };
    }
  };
}

function resolveDatabasePath(value) {
  const configured = value ?? process.env.RELAY_DATABASE_PATH;
  return configured ? resolve(configured) : join(homedir(), ".relay", "relay.sqlite");
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
