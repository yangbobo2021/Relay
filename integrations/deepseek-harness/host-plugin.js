import { PluginHost } from "@relay/plugin-sdk";

import { createDshWebDistribution } from "./distribution.mjs";

export {
  installClaudeSessionEventType,
  installCodexSessionEventType,
  installRelaySessionEventTypes,
} from "./dsh-plugin.js";

export const name = "relay-runtime-host";
export const inject = [
  "agentDefaultModel", "agents", "approval", "attachments", "fs", "llm", "sessions", "sessionPersistence",
  "tools", "typert", "userQuestions", "webServer",
];

export async function apply(ctx, config = {}) {
  const host = new PluginHost();
  const releaseOwnership = ctx.effect(() => () => host.dispose(), "relay.pluginHost()");
  try {
    await host.activate(createDshWebDistribution(ctx, config));
  } catch (error) {
    try {
      await releaseOwnership();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Relay plugin activation failed: ${error?.message ?? error}; Cordis cleanup also failed`,
        { cause: error },
      );
    }
    throw error;
  }
}
