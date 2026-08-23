import { createEventRuntimePlugin } from "@relay/plugin-event-runtime";
import { createDshEventsPlugin, createDshPlatformPlugin } from "./dsh-plugin.js";

export const DSH_EVENTS_DISTRIBUTION = Object.freeze({
  id: "relay.distribution.events", version: "1.0.0",
  plugins: Object.freeze(["relay.dsh.platform", "relay.event-runtime", "relay.dsh.events"]),
});

export function createDshEventsDistribution(ctx, config = {}) {
  return [
    createDshPlatformPlugin(ctx, config),
    createEventRuntimePlugin({ databasePath: config.databasePath, pollIntervalMs: config.pollIntervalMs }),
    createDshEventsPlugin(ctx, config),
  ];
}
