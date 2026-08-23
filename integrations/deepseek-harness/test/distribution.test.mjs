import assert from "node:assert/strict";
import test from "node:test";

import { DSH_EVENTS_DISTRIBUTION, createDshEventsDistribution } from "../distribution.mjs";
import { createDshEventsPlugin } from "../dsh-plugin.js";

test("DSH Events distribution contains no execution backend", () => {
  assert.equal(DSH_EVENTS_DISTRIBUTION.id, "relay.distribution.events");
  assert.deepEqual(DSH_EVENTS_DISTRIBUTION.plugins, [
    "relay.dsh.platform", "relay.event-runtime", "relay.dsh.events",
  ]);
  const definitions = createDshEventsDistribution({}, {});
  assert.deepEqual(definitions.map(plugin => plugin.manifest.id), DSH_EVENTS_DISTRIBUTION.plugins);
  assert.equal(definitions.some(plugin => /codex|claude/.test(plugin.manifest.id)), false);
});

test("Events requires its runtime capabilities and attaches provider-neutrally", () => {
  const plugin = createDshEventsPlugin({});
  assert.deepEqual(plugin.manifest.requires, {
    "relay.events.v1": "^1.0.0",
    "relay.monitors.v1": "^1.0.0",
  });
  assert.deepEqual(plugin.manifest.optional, {});
});
