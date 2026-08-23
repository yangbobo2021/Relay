import { fileURLToPath } from "node:url";
import { PluginHost } from "@relay/plugin-sdk";
import { createClaudeExecutionPlugin } from "@relay/plugin-claude";
import { ensureDshCore, installManagedPreset } from "@relay/dsh-core/runtime";
import { createDshClaudePlugin } from "./dsh-plugin.js";
export { installClaudeSessionEventType } from "./dsh-plugin.js";

export const name = "relay-dsh-claude";
export const inject = ["agents", "llm", "sessions", "sessionPersistence", "tools", "typert", "webServer"];

export async function apply(ctx, config = {}) {
  const core = await ensureDshCore(ctx, config);
  const host = new PluginHost();
  const release = ctx.effect(() => async () => { await host.dispose(); await core.release(); }, "relay.dshClaude()");
  try {
    await installManagedPreset(fileURLToPath(new URL("../presets/relay-claude", import.meta.url)), "relay-claude");
    await host.activate([
      createClaudeExecutionPlugin({
        client: config.claude?.client, backend: config.claudeBackend, command: config.claudeCommand,
        args: config.claudeArgs, codeExecutablePath: config.claudeCodeExecutablePath,
        requestTimeoutMs: config.claudeRequestTimeoutMs, cwd: config.cwd,
      }),
      createDshClaudePlugin(ctx, core.value, config),
    ]);
  } catch (error) { await release(); throw error; }
}
