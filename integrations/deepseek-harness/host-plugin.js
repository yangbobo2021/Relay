import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { createTimerWait, MonitorRuntime, TimerObserver } from "../../packages/monitor-runtime/index.mjs";
import { RelayRuntime, RelayStore } from "../../packages/runtime/index.mjs";
import { ClaudeCliClient } from "../claude/cli-client.mjs";
import { ClaudeSdkClient } from "../claude/sdk-client.mjs";
import { ClaudeSessionRuntime } from "../claude/session-runtime.mjs";
import { CodexAppServerClient, NATIVE_CODEX_APP_SERVER_ARGS } from "../codex/app-server-client.mjs";
import { CodexSessionRuntime } from "../codex/session-runtime.mjs";
import { installRelayAgentBridge } from "./agent-bridge.js";
import { ClaudeDshAdapter, CLAUDE_ACTIVITY_EVENT, CLAUDE_PROVIDER } from "./claude-adapter.js";
import { ClaudeLinkStore } from "./claude-link-store.js";
import { handleClaudeSdkRequest } from "./claude-tools.js";
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
  installRelaySessionEventTypes();
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
  const claudeRuntime = new ClaudeSessionRuntime({
    client: createClaudeClient(config),
    cwd: config.cwd ?? process.cwd(),
  });
  const claudeReady = claudeRuntime.initialize();
  void claudeReady.catch((error) => {
    ctx.logger.error(`Relay Claude backend failed to initialize: ${error?.stack ?? error}`);
  });
  const claudeAdapter = new ClaudeDshAdapter({
    runtime: claudeRuntime,
    ready: claudeReady,
    linkStore: new ClaudeLinkStore(resolveClaudeLinkPath(config.claudeLinkPath)),
    logger: ctx.logger,
  });
  const releaseCodexAdapter = ctx.llm.registerAdapter([CODEX_PROVIDER], codexAdapter);
  const releaseClaudeAdapter = ctx.llm.registerAdapter([CLAUDE_PROVIDER], claudeAdapter);
  const stopRelayAgentStream = ctx.on("llm/stream", (options, next) => {
    if (options.purpose || !options.sessionId) return next();
    const agent = ctx.agents.get(options.sessionId);
    if (!agent) return next();
    if (codexAdapter.servesAgent(agent)) return codexAdapter.stream(options);
    if (claudeAdapter.servesAgent(agent)) return claudeAdapter.stream(options);
    return next();
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
  const onClaudeRequest = (request) => {
    void handleClaudeSdkRequest(ctx, {
      adapter: claudeAdapter,
      runtime: claudeRuntime,
      request,
    }).catch((error) => {
      ctx.logger.error(`Relay failed to handle a Claude interaction: ${error?.stack ?? error}`);
    });
  };
  claudeRuntime.on("request", onClaudeRequest);
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
    const attachedClaude = claudeAdapter.attachAgent(agent);
    if (config.debug) ctx.logger.info(`Relay observed agent ${agent.id} (codex=${attachedCodex}, claude=${attachedClaude})`);
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
    if (agent) {
      codexAdapter.attachAgent(agent, agentPreset);
      claudeAdapter.attachAgent(agent, agentPreset);
    }
  }, { global: true });
  const stopAgentDisposed = ctx.on("agent/disposed", ({ agent }) => {
    codexAdapter.detachAgent(agent.id);
    claudeAdapter.detachAgent(agent.id);
  });
  for (const agent of ctx.agents.list()) {
    codexAdapter.attachAgent(agent);
    claudeAdapter.attachAgent(agent);
  }

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
    stopRelayAgentStream();
    codexRuntime.off("request", onCodexRequest);
    claudeRuntime.off("request", onClaudeRequest);
    releaseCodexAdapter();
    releaseClaudeAdapter();
    await codexRuntime.close();
    await claudeRuntime.close();
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

function resolveClaudeLinkPath(value) {
  const configured = value ?? process.env.RELAY_CLAUDE_LINK_PATH;
  return configured ? resolve(configured) : join(homedir(), ".relay", "claude-dsh-links.json");
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function createClaudeClient(config) {
  const backend = config.claudeBackend ?? "auto";
  if (backend === "cli") return createClaudeCliClient(config);
  const sdkClient = new ClaudeSdkClient({
    pathToClaudeCodeExecutable: config.claudeCodeExecutablePath,
    requestTimeoutMs: positiveInteger(config.claudeRequestTimeoutMs, 30 * 60_000),
  });
  if (backend === "sdk") return sdkClient;
  return new FallbackClaudeClient({
    primary: sdkClient,
    fallback: createClaudeCliClient(config),
  });
}

function createClaudeCliClient(config) {
  return new ClaudeCliClient({
    command: config.claudeCommand ?? "claude",
    args: config.claudeArgs ?? [],
    requestTimeoutMs: positiveInteger(config.claudeRequestTimeoutMs, 30 * 60_000),
  });
}

class FallbackClaudeClient extends ClaudeCliClient {
  constructor({ primary, fallback }) {
    super();
    this.primary = primary;
    this.fallback = fallback;
    this.active = primary;
    this.relayEvents = ["activity", "request", "diagnostic", "exit"];
    for (const event of this.relayEvents) {
      primary.on(event, (...args) => this.emit(event, ...args));
      fallback.on(event, (...args) => this.emit(event, ...args));
    }
  }

  async start() {
    try {
      await this.primary.start();
      this.active = this.primary;
    } catch (error) {
      this.emit("diagnostic", `Claude Agent SDK unavailable; falling back to CLI: ${error.message}`);
      await this.fallback.start();
      this.active = this.fallback;
    }
  }

  listModels(...args) { return this.active.listModels(...args); }
  createSession(...args) { return this.active.createSession(...args); }
  resumeSession(...args) { return this.active.resumeSession(...args); }
  sendMessage(...args) { return this.active.sendMessage(...args); }
  interruptTurn(...args) { return this.active.interruptTurn(...args); }
  releaseSession(...args) { return this.active.releaseSession(...args); }
  resolveRequest(...args) { return this.active.resolveRequest?.(...args); }
  rejectRequest(...args) { return this.active.rejectRequest?.(...args); }
  close(...args) { return this.active.close(...args); }
}

export function installRelaySessionEventTypes() {
  installSessionEventType(CODEX_ACTIVITY_EVENT, "Codex");
  installSessionEventType(CLAUDE_ACTIVITY_EVENT, "Claude");
}

export function installCodexSessionEventType() {
  installSessionEventType(CODEX_ACTIVITY_EVENT, "Codex");
}

export function installClaudeSessionEventType() {
  installSessionEventType(CLAUDE_ACTIVITY_EVENT, "Claude");
}

function installSessionEventType(eventType, label) {
  if (KNOWN_SESSION_EVENT_TYPES.has(eventType)) return;
  const registry = KNOWN_SESSION_EVENT_TYPES;
  if (typeof registry.add !== "function") {
    throw new Error(`This DSH build cannot register Relay ${label} session events`);
  }
  registry.add(eventType);
  if (!registry.has(eventType)) {
    throw new Error(`Relay ${label} session event registration did not take effect`);
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
