import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { KNOWN_SESSION_EVENT_TYPES } from "@deepseek-ai/dsh-session";
import { definePlugin } from "@relay/plugin-sdk";
import { CodexDshAdapter, CODEX_ACTIVITY_EVENT, CODEX_PROVIDER } from "./codex-adapter.js";
import { RelayCodexTerminalGateway } from "./codex-terminal-gateway.js";
import { CodexLinkStore } from "./codex-link-store.js";
import { CODEX_APP_DYNAMIC_TOOLS, handleCodexServerRequest } from "./codex-tools.js";
import { RelayWorkspaceFilesGateway } from "./workspace-files-gateway.js";

export function createDshCodexPlugin(ctx, config = {}) {
  return definePlugin({
    manifest: {
      id: "relay.dsh.codex", version: "1.0.0",
      provides: { "relay.dsh.codex.v1": "1.0.0" },
      requires: { "relay.execution.codex.v1": "^1.0.0" },
      optional: { "relay.terminal.codex.v1": "^1.0.0" },
      permissions: ["dsh:llm", "dsh:agents", "dsh:web-server"],
    },
    async activate({ capabilities, defer }) {
      installCodexSessionEventType();
      const runtime = capabilities.require("relay.execution.codex.v1");
      const terminal = capabilities.optional("relay.terminal.codex.v1");
      const resolveAgent = createAgentLookup(ctx);
      const adapter = new CodexDshAdapter({
        runtime, ready: runtime.whenReady(),
        linkStore: new CodexLinkStore(resolveLinkPath(config.codexLinkPath)),
        attachments: ctx.attachments, logger: ctx.logger,
        dynamicTools: CODEX_APP_DYNAMIC_TOOLS,
      });
      defer(ctx.llm.registerAdapter([CODEX_PROVIDER], adapter));
      defer(runtime.subscribeRequest((request) => {
        void handleCodexServerRequest(ctx, { adapter, runtime, request })
          .catch(error => ctx.logger.error(`Relay failed to handle a Codex interaction: ${error?.stack ?? error}`));
      }));
      if (terminal) await activateCordisScope(ctx, defer, "relay Codex terminal remote", (scope) => {
        new RelayCodexTerminalGateway(scope, { terminal, resolveAgent });
      });
      await activateCordisScope(ctx, defer, "relay Codex workspace remote", (scope) => {
        new RelayWorkspaceFilesGateway(scope, { resolveAgent });
      });
      defer(ctx.on("llm/stream", (options, next) => {
        if (options.purpose || !options.sessionId) return next();
        const agent = ctx.agents.get(options.sessionId);
        return agent && adapter.servesAgent(agent) ? adapter.stream(options) : next();
      }, { global: true, prepend: true }));
      defer(ctx.on("agent/created", ({ agent }) => { adapter.attachAgent(agent); }));
      defer(ctx.on("agent-preset/selected", (sessionId, preset) => {
        const agent = ctx.agents.get(sessionId);
        if (agent) adapter.attachAgent(agent, preset);
      }, { global: true }));
      defer(ctx.on("agent/disposed", ({ agent }) => { adapter.detachAgent(agent.id); }));
      for (const agent of ctx.agents.list()) adapter.attachAgent(agent);
      return { capabilities: { "relay.dsh.codex.v1": Object.freeze({ provider: CODEX_PROVIDER }) } };
    },
  });
}

export function installCodexSessionEventType() {
  if (KNOWN_SESSION_EVENT_TYPES.has(CODEX_ACTIVITY_EVENT)) return;
  if (typeof KNOWN_SESSION_EVENT_TYPES.add !== "function") throw new Error("This DSH build cannot register Relay Codex session events");
  KNOWN_SESSION_EVENT_TYPES.add(CODEX_ACTIVITY_EVENT);
}

async function activateCordisScope(ctx, defer, name, setup) {
  const fiber = ctx.plugin({ name, apply: setup });
  defer(() => fiber.dispose());
  await fiber;
}

function createAgentLookup(ctx) {
  const lookup = ctx.typert.lookups.get("agent");
  if (!lookup) throw new Error("Codex requires DSH's configured shared Agent lookup");
  return async (sessionId) => {
    const agent = await lookup.resolve(sessionId);
    if (!agent) throw new Error(`session ${sessionId} was not found`);
    return agent;
  };
}

function resolveLinkPath(value) {
  const configured = value ?? process.env.RELAY_CODEX_LINK_PATH;
  return configured ? resolve(configured) : join(homedir(), ".relay", "codex-dsh-links.json");
}
