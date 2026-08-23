import { createEventRuntimePlugin } from "@relay/plugin-event-runtime";
import { createDshCoreCompositionPlugin, createDshPlatformPlugin } from "./dsh-plugin.js";

export const DSH_CORE_DISTRIBUTION = Object.freeze({
  id: "relay.distribution.dsh-core", version: "1.0.0",
  plugins: Object.freeze(["relay.dsh.platform", "relay.event-runtime", "relay.dsh.core-composition"]),
});

export function createDshCoreDistribution(ctx, config = {}) {
  return [
    createDshPlatformPlugin(ctx, config),
    createEventRuntimePlugin({ databasePath: config.databasePath, pollIntervalMs: config.pollIntervalMs }),
    createDshCoreCompositionPlugin(ctx, config),
  ];
}
