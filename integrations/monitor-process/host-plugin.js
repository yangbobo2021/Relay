import { homedir } from "node:os";
import { join } from "node:path";

import { installProcessAgentBridge } from "./agent-bridge.js";
import { createProcessCapabilityProvider, ProcessHandleAuthority } from "./src/process-capability.mjs";

export const name = "relay-dsh-plugin-monitor-process";
export const inject = ["agents", "tools"];

export function apply(ctx, config = {}) {
  const authority = new ProcessHandleAuthority({
    identityFile: config.identityFile ?? join(homedir(), ".dsh", "relay-process-monitor", "host-identity.json"),
    inspectProcess: config.inspectProcess,
    clock: config.clock,
  });
  const fiber = ctx.inject(["relayMonitorCapabilities"], scope => {
    scope.effect(() => scope.relayMonitorCapabilities.registerCapabilityProvider(createProcessCapabilityProvider(authority)), "relay Process capability");
    const attach = agent => {
      if (!scope.agents.roots().includes(agent)) return;
      const cwd = agent.session?.header?.cwd;
      if (typeof cwd !== "string") return;
      scope.effect(() => installProcessAgentBridge(agent.ctx, {
        sessionId: agent.id,
        cwd,
        issueHandle: input => authority.issue(input),
      }), "relay Process Agent tool");
    };
    scope.effect(() => scope.on("agent/created", ({ agent }) => attach(agent)), "relay Process Agent bridge");
    for (const agent of scope.agents.roots()) attach(agent);
  });
  ctx.effect(() => () => fiber.dispose(), "relay Process injection");
}

export { createProcessCapabilityProvider, inspectOperatingSystemProcess, ProcessHandleAuthority } from "./src/process-capability.mjs";
