import assert from "node:assert/strict";
import test from "node:test";

import { PluginHost, definePlugin } from "@relay/plugin-sdk";
import { DSH_CORE_DISTRIBUTION, createDshCoreDistribution } from "../distribution.mjs";
import { createDshCoreCompositionPlugin } from "../dsh-plugin.js";

test("DSH Core distribution contains no execution backend", () => {
  assert.equal(DSH_CORE_DISTRIBUTION.id, "relay.distribution.dsh-core");
  assert.deepEqual(DSH_CORE_DISTRIBUTION.plugins, [
    "relay.dsh.platform", "relay.event-runtime", "relay.dsh.core-composition",
  ]);
  const definitions = createDshCoreDistribution({}, {});
  assert.deepEqual(definitions.map(plugin => plugin.manifest.id), DSH_CORE_DISTRIBUTION.plugins);
  assert.equal(definitions.some(plugin => /codex|claude/.test(plugin.manifest.id)), false);
});

test("Core composition can run without optional Events capabilities", async () => {
  const ctx = { agents: { list: () => [], roots: () => [] }, on: () => () => {} };
  const workspace = definePlugin({
    manifest: { id: "fake.workspace", version: "1.0.0", provides: { "relay.dsh.workspace.v1": "1.0.0" } },
    activate: () => ({ capabilities: { "relay.dsh.workspace.v1": { async resolveAgent() {} } } }),
  });
  const host = new PluginHost();
  await host.activate([createDshCoreCompositionPlugin(ctx), workspace]);
  assert.deepEqual(host.capabilities.require("relay.dsh.core.v1"), { events: false });
  await host.dispose();
});
