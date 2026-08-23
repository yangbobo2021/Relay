import { definePlugin } from "@relay/plugin-sdk";

import { installRelayAgentBridge } from "./agent-bridge.js";
import { registerRelayEventIngress } from "./event-ingress.js";
import { DshInboxAdapter } from "./inbox-adapter.js";
import { RelayManagementGateway } from "./management-gateway.js";

export function createDshPlatformPlugin(ctx, config = {}) {
  return definePlugin({
    manifest: {
      id: "relay.dsh.platform", version: "1.0.0",
      provides: { "relay.delivery.v1": "1.0.0", "relay.logging.v1": "1.0.0" },
      permissions: ["dsh:sessions", "dsh:logging"],
    },
    activate() {
      const resolveAgent = createSharedAgentLookup(ctx);
      const delivery = new DshInboxAdapter({
        resolveAgent,
        debug: config.debug ?? false,
        async awaitDurable(agent) {
          await agent.whenIdle();
          await ctx.sessions.flush(agent.session);
        },
      });
      return { capabilities: {
        "relay.delivery.v1": Object.freeze({ deliver: delivery.deliver.bind(delivery) }),
        "relay.logging.v1": ctx.logger,
      } };
    },
  });
}

export function createDshEventsPlugin(ctx, config = {}) {
  return definePlugin({
    manifest: {
      id: "relay.dsh.events", version: "1.0.0",
      provides: { "relay.dsh.events.v1": "1.0.0" },
      requires: { "relay.events.v1": "^1.0.0", "relay.monitors.v1": "^1.0.0" },
      permissions: ["dsh:agents", "dsh:web-server"],
    },
    async activate({ capabilities, defer }) {
      const events = capabilities.require("relay.events.v1");
      const monitors = capabilities.require("relay.monitors.v1");
      await activateCordisScope(ctx, defer, "relay DSH management remote", (scope) => {
        new RelayManagementGateway(scope, { relayRuntime: events, monitorWorker: monitors });
      });
      defer(registerRelayEventIngress(ctx, {
        relayRuntime: events,
        token: config.ingressToken ?? process.env.RELAY_INGRESS_TOKEN,
        maxBodyBytes: positiveInteger(config.ingressMaxBodyBytes, 1_048_576),
      }));
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
      for (const agent of ctx.agents.roots()) attach(agent);
      return { capabilities: { "relay.dsh.events.v1": Object.freeze({ active: true }) } };
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
