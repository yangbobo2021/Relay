import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { createTimerWait, MonitorRuntime, TimerObserver } from "../../packages/monitor-runtime/index.mjs";
import { RelayRuntime, RelayStore } from "../../packages/runtime/index.mjs";
import { CodexAppServerClient, NATIVE_CODEX_APP_SERVER_ARGS } from "../codex/app-server-client.mjs";
import { CodexSessionRuntime } from "../codex/session-runtime.mjs";
import { installRelayAgentBridge } from "./agent-bridge.js";
import { CodexDshAdapter, CODEX_ACTIVITY_EVENT, CODEX_PROVIDER } from "./codex-adapter.js";
import { CodexLinkStore } from "./codex-link-store.js";
import { handleCodexServerRequest } from "./codex-tools.js";
import { registerRelayEventIngress } from "./event-ingress.js";
import { DshInboxAdapter } from "./inbox-adapter.js";
import { RelayManagementGateway } from "./management-gateway.js";
import { KNOWN_SESSION_EVENT_TYPES } from "@deepseek-ai/dsh-session";

export const name = "relay-runtime-host";
export const inject = [
  "agentDefaultModel", "agents", "approval", "attachments", "llm", "sessions", "sessionPersistence",
  "tools", "typert", "userQuestions", "webServer",
];

export function apply(ctx, config = {}) {
  installCodexSessionEventType();
  const databasePath = resolveDatabasePath(config.databasePath);
  mkdirSync(dirname(databasePath), { recursive: true });
  const store = new RelayStore(databasePath);
  const codexClient = new CodexAppServerClient({
    command: config.codexCommand ?? "codex",
    args: config.codexArgs ?? NATIVE_CODEX_APP_SERVER_ARGS,
    requestTimeoutMs: positiveInteger(config.codexRequestTimeoutMs, 60_000),
  });
  const codexRuntime = new CodexSessionRuntime({
    client: codexClient,
    cwd: config.cwd ?? process.cwd(),
  });
  const codexReady = codexRuntime.initialize();
  void codexReady.catch((error) => {
    ctx.logger.error(`Relay Codex App Server failed to initialize: ${error?.stack ?? error}`);
  });
  const codexAdapter = new CodexDshAdapter({
    runtime: codexRuntime,
    ready: codexReady,
    linkStore: new CodexLinkStore(resolveCodexLinkPath(config.codexLinkPath)),
    attachments: ctx.attachments,
    logger: ctx.logger,
  });
  const releaseCodexAdapter = ctx.llm.registerAdapter([CODEX_PROVIDER], codexAdapter);
  const stopCodexStream = ctx.on("llm/stream", (options, next) => {
    if (options.purpose || !options.sessionId) return next();
    const agent = ctx.agents.get(options.sessionId);
    if (!agent || !codexAdapter.servesAgent(agent)) return next();
    return codexAdapter.stream(options);
  }, { global: true, prepend: true });
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
    router: createExactEventRouter(),
    inbox,
    monitorRegistrar: registrar,
    workerId: "relay-dsh-dispatcher",
  });
  ctx.effect(() => registerRelayEventIngress(ctx, {
    relayRuntime,
    token: config.ingressToken ?? process.env.RELAY_INGRESS_TOKEN,
    maxBodyBytes: positiveInteger(config.ingressMaxBodyBytes, 1_048_576),
  }), "relay.eventIngress()");
  const onCodexRequest = (request) => {
    void handleCodexServerRequest(ctx, {
      adapter: codexAdapter,
      relayRuntime,
      runtime: codexRuntime,
      request,
    }).catch((error) => {
      ctx.logger.error(`Relay failed to handle a Codex interaction: ${error?.stack ?? error}`);
    });
  };
  codexRuntime.on("request", onCodexRequest);
  const worker = new MonitorRuntime({
    store,
    observer,
    relayRuntime,
    workerId: "relay-timer-worker",
  });
  new RelayManagementGateway(ctx, {
    relayRuntime,
    monitorWorker: worker,
  });

  const stopAgentCreated = ctx.on("agent/created", ({ agent }) => {
    const attachedCodex = codexAdapter.attachAgent(agent);
    if (config.debug) ctx.logger.info(`Relay observed agent ${agent.id} (codex=${attachedCodex})`);
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
  const stopPresetSelected = ctx.on("agent-preset/selected", (sessionId, agentPreset) => {
    const agent = ctx.agents.get(sessionId);
    if (config.debug) ctx.logger.info(`Relay observed preset ${agentPreset} for ${sessionId} (agent=${Boolean(agent)})`);
    if (agent) codexAdapter.attachAgent(agent, agentPreset);
  }, { global: true });
  const stopAgentDisposed = ctx.on("agent/disposed", ({ agent }) => {
    codexAdapter.detachAgent(agent.id);
  });
  for (const agent of ctx.agents.list()) codexAdapter.attachAgent(agent);

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

  ctx.effect(() => async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stopAgentCreated();
    stopPresetSelected();
    stopAgentDisposed();
    stopCodexStream();
    codexRuntime.off("request", onCodexRequest);
    releaseCodexAdapter();
    await codexRuntime.close();
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

function resolveCodexLinkPath(value) {
  const configured = value ?? process.env.RELAY_CODEX_LINK_PATH;
  return configured ? resolve(configured) : join(homedir(), ".relay", "codex-dsh-links.json");
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function installCodexSessionEventType() {
  if (KNOWN_SESSION_EVENT_TYPES.has(CODEX_ACTIVITY_EVENT)) return;
  const registry = KNOWN_SESSION_EVENT_TYPES;
  if (typeof registry.add !== "function") {
    throw new Error("This DSH build cannot register Relay Codex session events");
  }
  registry.add(CODEX_ACTIVITY_EVENT);
  if (!registry.has(CODEX_ACTIVITY_EVENT)) {
    throw new Error("Relay Codex session event registration did not take effect");
  }
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
        summary: `Deliver ${eventType} to its waiting DSH Session.`,
      };
    },
  };
}
