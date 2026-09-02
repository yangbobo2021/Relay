import { installTimeAgentBridge } from "./agent-bridge.js";
import { createTimeBundleType, createTimeProvider } from "./src/time-bundle.mjs";

export const name = "relay-dsh-plugin-monitor-time";
export const inject = ["agents", "tools"];

export function apply(ctx, config = {}) {
  const fiber = ctx.inject(["relayEvents", "relayMonitorObservers", "relayMonitorBundles"], scope => {
    const clock = config.clock ?? (() => new Date());
    scope.effect(() => scope.relayMonitorObservers.register(createTimeProvider({ clock })), "relay Time observer/detector");
    scope.effect(() => scope.relayMonitorObservers.register(createTimeProvider({ id: "clock", clock })), "relay Time legacy observer alias");
    scope.effect(() => scope.relayMonitorBundles.registerBundleType(createTimeBundleType({
      clock,
      idFactory: config.idFactory,
    })), "relay Time Bundle Type");
    const attach = agent => {
      if (!scope.agents.roots().includes(agent)) return;
      scope.effect(() => installTimeAgentBridge(agent.ctx, {
        sessionId: agent.id,
        scheduleTimer: async input => {
          const proposal = await scope.relayMonitorBundles.instantiateBundleType({
            typeId: "time.deadline",
            bundleVersion: 1,
            sessionId: input.sessionId,
            taskSummary: input.taskSummary,
            authorization: { sessionId: input.sessionId, cwd: agent.session?.header?.cwd ?? null },
            parameters: {
              ...(input.afterSeconds === undefined ? {} : { after_seconds: input.afterSeconds }),
              ...(input.deadline === undefined ? {} : { deadline: input.deadline }),
              allow_immediate: input.allowImmediate,
              resume_prompt: input.resumePrompt,
            },
          });
          await scope.relayEvents.registerWaits(proposal);
          return proposal.timer;
        },
      }), "relay Time Agent tool");
    };
    scope.effect(() => scope.on("agent/created", ({ agent }) => attach(agent)), "relay Time Agent bridge");
    for (const agent of scope.agents.roots()) attach(agent);
  });
  ctx.effect(() => () => fiber.dispose(), "relay Time injection");
}

export { createTimeBundleType, createTimeProvider, createTimerWait, detectTimeEvents } from "./src/time-bundle.mjs";
