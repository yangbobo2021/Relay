import { PluginHost } from "@relay/plugin-sdk";
import { createDshEventsDistribution } from "./distribution.mjs";

export const name = "relay-plugin-events";
export const inject = ["agents", "sessions", "sessionPersistence", "tools", "typert", "webServer"];

export async function apply(ctx, config = {}) {
  const host = new PluginHost();
  ctx.effect(() => () => host.dispose(), "relay.events()");
  await host.activate(createDshEventsDistribution(ctx, config));
}
