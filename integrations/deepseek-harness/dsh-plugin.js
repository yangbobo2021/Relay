import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { definePlugin } from "@relay/plugin-sdk";
import { KNOWN_SESSION_EVENT_TYPES } from "@deepseek-ai/dsh-session";

import { installRelayAgentBridge } from "./agent-bridge.js";
import { ClaudeDshAdapter, CLAUDE_ACTIVITY_EVENT, CLAUDE_PROVIDER } from "./claude-adapter.js";
import { ClaudeLinkStore } from "./claude-link-store.js";
import { handleClaudeSdkRequest } from "./claude-tools.js";
import { CodexDshAdapter, CODEX_ACTIVITY_EVENT, CODEX_PROVIDER } from "./codex-adapter.js";
import { RelayCodexTerminalGateway } from "./codex-terminal-gateway.js";
import { CodexLinkStore } from "./codex-link-store.js";
import { CODEX_APP_DYNAMIC_TOOLS, CODEX_DYNAMIC_TOOLS, handleCodexServerRequest } from "./codex-tools.js";
import { registerRelayEventIngress } from "./event-ingress.js";
import { DshInboxAdapter } from "./inbox-adapter.js";
import { RelayManagementGateway } from "./management-gateway.js";
import { RelayWorkspaceFilesGateway } from "./workspace-files-gateway.js";

export function createDshPlatformPlugin(ctx, config = {}) {
  return definePlugin({
    manifest: {
      id: "relay.dsh.platform",
      version: "1.0.0",
      provides: {
        "relay.delivery.v1": "1.0.0",
        "relay.logging.v1": "1.0.0",
        "relay.dsh.workspace.v1": "1.0.0",
      },
      permissions: ["dsh:sessions", "dsh:workspace", "dsh:logging"],
    },
    async activate({ defer }) {
      const resolveAgentResult = createSharedAgentLookup(ctx);
      const resolveAgent = async (sessionId) => {
        const resolved = await resolveAgentResult(sessionId);
        if (resolved.error) throw new Error(resolved.error.message);
        return resolved.agent;
      };
      await activateCordisScope(ctx, defer, "relay DSH workspace remote", (scope) => {
        new RelayWorkspaceFilesGateway(scope, { resolveAgent });
      });
      const delivery = new DshInboxAdapter({
        resolveAgent: resolveAgentResult,
        debug: config.debug ?? false,
        async awaitDurable(agent) {
          await agent.whenIdle();
          await ctx.sessions.flush(agent.session);
        },
      });
      return {
        capabilities: {
          "relay.delivery.v1": Object.freeze({ deliver: delivery.deliver.bind(delivery) }),
          "relay.logging.v1": ctx.logger,
          "relay.dsh.workspace.v1": Object.freeze({ resolveAgent }),
        },
      };
    },
  });
}

export function createDshCompositionPlugin(ctx, config = {}) {
  return definePlugin({
    manifest: {
      id: "relay.dsh.composition",
      version: "1.0.0",
      provides: { "relay.dsh.integration.v1": "1.0.0" },
      requires: { "relay.dsh.workspace.v1": "^1.0.0" },
      optional: {
        "relay.events.v1": "^1.0.0",
        "relay.monitors.v1": "^1.0.0",
        "relay.execution.codex.v1": "^1.0.0",
        "relay.terminal.codex.v1": "^1.0.0",
        "relay.execution.claude.v1": "^1.0.0",
      },
      permissions: ["dsh:llm", "dsh:agents", "dsh:web-server"],
    },
    async activate({ capabilities, defer }) {
      const workspace = capabilities.require("relay.dsh.workspace.v1");
      const events = capabilities.optional("relay.events.v1");
      const monitors = capabilities.optional("relay.monitors.v1");
      const codex = capabilities.optional("relay.execution.codex.v1");
      const codexTerminal = capabilities.optional("relay.terminal.codex.v1");
      const claude = capabilities.optional("relay.execution.claude.v1");
      const adapters = [];

      let codexAdapter = null;
      if (codex) {
        installCodexSessionEventType();
        codexAdapter = new CodexDshAdapter({
          runtime: codex,
          ready: codex.whenReady(),
          linkStore: new CodexLinkStore(resolveCodexLinkPath(config.codexLinkPath)),
          attachments: ctx.attachments,
          logger: ctx.logger,
          dynamicTools: events ? CODEX_DYNAMIC_TOOLS : CODEX_APP_DYNAMIC_TOOLS,
        });
        adapters.push(codexAdapter);
        defer(ctx.llm.registerAdapter([CODEX_PROVIDER], codexAdapter));
        defer(codex.subscribeRequest((request) => {
          void handleCodexServerRequest(ctx, {
            adapter: codexAdapter,
            relayRuntime: events,
            runtime: codex,
            request,
          }).catch((error) => ctx.logger.error(`Relay failed to handle a Codex interaction: ${error?.stack ?? error}`));
        }));
      }

      let claudeAdapter = null;
      if (claude) {
        installClaudeSessionEventType();
        claudeAdapter = new ClaudeDshAdapter({
          runtime: claude,
          ready: claude.whenReady(),
          linkStore: new ClaudeLinkStore(resolveClaudeLinkPath(config.claudeLinkPath)),
          logger: ctx.logger,
        });
        adapters.push(claudeAdapter);
        defer(ctx.llm.registerAdapter([CLAUDE_PROVIDER], claudeAdapter));
        defer(claude.subscribeRequest((request) => {
          void handleClaudeSdkRequest(ctx, {
            adapter: claudeAdapter,
            runtime: claude,
            request,
          }).catch((error) => ctx.logger.error(`Relay failed to handle a Claude interaction: ${error?.stack ?? error}`));
        }));
      }

      if (codexTerminal || (events && monitors)) {
        await activateCordisScope(ctx, defer, "relay DSH workbench remotes", (scope) => {
          if (codexTerminal) {
            new RelayCodexTerminalGateway(scope, {
              terminal: codexTerminal,
              resolveAgent: workspace.resolveAgent,
            });
          }
          if (events && monitors) {
            new RelayManagementGateway(scope, { relayRuntime: events, monitorWorker: monitors });
          }
        });
      }
      if (events) {
        defer(registerRelayEventIngress(ctx, {
          relayRuntime: events,
          token: config.ingressToken ?? process.env.RELAY_INGRESS_TOKEN,
          maxBodyBytes: positiveInteger(config.ingressMaxBodyBytes, 1_048_576),
        }));
      }
      defer(ctx.on("llm/stream", (options, next) => {
        if (options.purpose || !options.sessionId) return next();
        const agent = ctx.agents.get(options.sessionId);
        if (!agent) return next();
        const adapter = adapters.find((candidate) => candidate.servesAgent(agent));
        return adapter ? adapter.stream(options) : next();
      }, { global: true, prepend: true }));

      defer(ctx.on("agent/created", ({ agent }) => {
        const attached = adapters.map((adapter) => adapter.attachAgent(agent));
        if (config.debug) ctx.logger.info(`Relay observed agent ${agent.id} (backends=${attached.join(",")})`);
        if (!events || !monitors || !ctx.agents.roots().includes(agent)) return;
        installRelayAgentBridge(agent.ctx, {
          sessionId: agent.id,
          registerWaits: events.registerWaits,
          cancelWaits: events.cancelWaits,
          scheduleTimer: async (input) => {
            const proposal = monitors.createTimerWait(input);
            await events.registerWaits(proposal);
            return proposal.timer;
          },
        });
      }));
      defer(ctx.on("agent-preset/selected", (sessionId, agentPreset) => {
        const agent = ctx.agents.get(sessionId);
        if (agent) adapters.forEach((adapter) => adapter.attachAgent(agent, agentPreset));
      }, { global: true }));
      defer(ctx.on("agent/disposed", ({ agent }) => {
        adapters.forEach((adapter) => adapter.detachAgent(agent.id));
      }));
      for (const agent of ctx.agents.list()) adapters.forEach((adapter) => adapter.attachAgent(agent));

      return {
        capabilities: {
          "relay.dsh.integration.v1": Object.freeze({
            backends: Object.freeze([
              ...(codex ? ["codex"] : []),
              ...(claude ? ["claude"] : []),
            ]),
            events: Boolean(events),
          }),
        },
      };
    },
  });
}

async function activateCordisScope(ctx, defer, name, setup) {
  const fiber = ctx.plugin({
    name,
    apply(scope) {
      return setup(scope);
    },
  });
  defer(() => fiber.dispose());
  await fiber;
}

function createSharedAgentLookup(ctx) {
  const lookup = ctx.typert.lookups.get("agent");
  if (!lookup) throw new Error("Relay requires DSH's configured shared Agent lookup");
  return async (sessionId) => {
    try {
      const agent = await lookup.resolve(sessionId);
      return agent ? { agent } : { error: { message: `session ${sessionId} was not found` } };
    } catch (error) {
      return { error: { message: error?.message ?? String(error) } };
    }
  };
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

export function installRelaySessionEventTypes() {
  installCodexSessionEventType();
  installClaudeSessionEventType();
}

export function installCodexSessionEventType() {
  installSessionEventType(CODEX_ACTIVITY_EVENT, "Codex");
}

export function installClaudeSessionEventType() {
  installSessionEventType(CLAUDE_ACTIVITY_EVENT, "Claude");
}

function installSessionEventType(eventType, label) {
  if (KNOWN_SESSION_EVENT_TYPES.has(eventType)) return;
  if (typeof KNOWN_SESSION_EVENT_TYPES.add !== "function") {
    throw new Error(`This DSH build cannot register Relay ${label} session events`);
  }
  KNOWN_SESSION_EVENT_TYPES.add(eventType);
  if (!KNOWN_SESSION_EVENT_TYPES.has(eventType)) {
    throw new Error(`Relay ${label} session event registration did not take effect`);
  }
}
