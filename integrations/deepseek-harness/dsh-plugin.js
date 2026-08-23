import { definePlugin } from "@relay/plugin-sdk";

import { installRelayAgentBridge } from "./agent-bridge.js";
import { registerRelayEventIngress } from "./event-ingress.js";
import { DshInboxAdapter } from "./inbox-adapter.js";
import { RelayManagementGateway } from "./management-gateway.js";
import { RelayWorkspaceFilesGateway } from "./workspace-files-gateway.js";

export function createDshPlatformPlugin(ctx, config = {}) {
  return definePlugin({
    manifest: {
      id: "relay.dsh.platform", version: "1.0.0",
      provides: {
        "relay.delivery.v1": "1.0.0", "relay.logging.v1": "1.0.0", "relay.dsh.workspace.v1": "1.0.0",
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
      return { capabilities: {
        "relay.delivery.v1": Object.freeze({ deliver: delivery.deliver.bind(delivery) }),
        "relay.logging.v1": ctx.logger,
        "relay.dsh.workspace.v1": Object.freeze({ resolveAgent }),
      } };
    },
  });
}

export function createDshCoreCompositionPlugin(ctx, config = {}) {
  return definePlugin({
    manifest: {
      id: "relay.dsh.core-composition", version: "1.0.0",
      provides: { "relay.dsh.core.v1": "1.0.0" },
      requires: { "relay.dsh.workspace.v1": "^1.0.0" },
      optional: { "relay.events.v1": "^1.0.0", "relay.monitors.v1": "^1.0.0" },
      permissions: ["dsh:agents", "dsh:web-server"],
    },
    async activate({ capabilities, defer }) {
      const events = capabilities.optional("relay.events.v1");
      const monitors = capabilities.optional("relay.monitors.v1");
      if (events && monitors) {
        await activateCordisScope(ctx, defer, "relay DSH management remote", (scope) => {
          new RelayManagementGateway(scope, { relayRuntime: events, monitorWorker: monitors });
        });
      }
      if (events) defer(registerRelayEventIngress(ctx, {
        relayRuntime: events,
        token: config.ingressToken ?? process.env.RELAY_INGRESS_TOKEN,
        maxBodyBytes: positiveInteger(config.ingressMaxBodyBytes, 1_048_576),
      }));
      if (events && monitors) {
        const attach = (agent) => {
          if (!ctx.agents.roots().includes(agent)) return;
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
        };
        defer(ctx.on("agent/created", ({ agent }) => { attach(agent); }));
        for (const agent of ctx.agents.list()) attach(agent);
      }
      return { capabilities: { "relay.dsh.core.v1": Object.freeze({ events: Boolean(events) }) } };
    },
  });
}

export async function activateCordisScope(ctx, defer, name, setup) {
  const fiber = ctx.plugin({ name, apply: setup });
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

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
