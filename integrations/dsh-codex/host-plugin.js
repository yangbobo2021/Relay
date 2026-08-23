import { fileURLToPath } from "node:url";
import { PluginHost } from "@relay/plugin-sdk";
import { createCodexExecutionPlugin } from "@relay/plugin-codex";
import { ensureDshCore, installManagedPreset } from "@relay/dsh-core/runtime";
import { createDshCodexPlugin } from "./dsh-plugin.js";
export { installCodexSessionEventType } from "./dsh-plugin.js";

export const name = "relay-dsh-codex";
export const inject = [
  "agents", "attachments", "llm", "sessions", "sessionPersistence", "tools", "typert", "webServer",
];

export async function apply(ctx, config = {}) {
  const core = await ensureDshCore(ctx, config);
  const host = new PluginHost();
  const release = ctx.effect(() => async () => {
    await host.dispose();
    await core.release();
  }, "relay.dshCodex()");
  try {
    await installManagedPreset(fileURLToPath(new URL("../presets/relay-codex", import.meta.url)), "relay-codex");
    await host.activate([
      createCodexExecutionPlugin({
        client: config.codex?.client, command: config.codexCommand, args: config.codexArgs,
        requestTimeoutMs: config.codexRequestTimeoutMs, cwd: config.cwd,
      }),
      createDshCodexPlugin(ctx, core.value, config),
    ]);
  } catch (error) {
    await release();
    throw error;
  }
}
