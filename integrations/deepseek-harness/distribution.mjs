import { createClaudeExecutionPlugin } from "@relay/plugin-claude";
import { createCodexExecutionPlugin } from "@relay/plugin-codex";
import { createEventRuntimePlugin } from "@relay/plugin-event-runtime";

import { createDshCompositionPlugin, createDshPlatformPlugin } from "./dsh-plugin.js";

export const DSH_WEB_DISTRIBUTION = Object.freeze({
  id: "relay.distribution.dsh-web",
  version: "1.0.0",
  plugins: Object.freeze([
    "relay.dsh.platform",
    "relay.event-runtime",
    "relay.execution.codex",
    "relay.execution.claude",
    "relay.dsh.composition",
  ]),
});

export function createDshWebDistribution(ctx, config = {}) {
  const factories = new Map([
    ["relay.dsh.platform", () => createDshPlatformPlugin(ctx, config)],
    ["relay.event-runtime", () => createEventRuntimePlugin({
      databasePath: config.databasePath,
      pollIntervalMs: config.pollIntervalMs,
    })],
    ["relay.execution.codex", () => createCodexExecutionPlugin({
      client: config.codex?.client,
      command: config.codexCommand,
      args: config.codexArgs,
      requestTimeoutMs: config.codexRequestTimeoutMs,
      cwd: config.cwd,
    })],
    ["relay.execution.claude", () => createClaudeExecutionPlugin({
      client: config.claude?.client,
      backend: config.claudeBackend,
      command: config.claudeCommand,
      args: config.claudeArgs,
      codeExecutablePath: config.claudeCodeExecutablePath,
      requestTimeoutMs: config.claudeRequestTimeoutMs,
      cwd: config.cwd,
    })],
    ["relay.dsh.composition", () => createDshCompositionPlugin(ctx, config)],
  ]);
  const selected = config.plugins ?? DSH_WEB_DISTRIBUTION.plugins;
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length) {
    throw new Error("Relay distribution plugins must be a unique array");
  }
  for (const id of selected) {
    if (!factories.has(id)) throw new Error(`Relay distribution contains unknown plugin ${id}`);
  }
  if (selected.some((id) => id === "relay.event-runtime" || id === "relay.dsh.composition")
      && !selected.includes("relay.dsh.platform")) {
    throw new Error("Relay distribution requires relay.dsh.platform");
  }
  return selected.map((id) => factories.get(id)());
}
