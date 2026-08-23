import assert from "node:assert/strict";
import test from "node:test";

import {
  PluginHost,
  definePlugin,
  satisfiesVersion,
  validateManifest,
} from "../index.mjs";

function plugin(manifest, activate) {
  return definePlugin({ manifest, activate });
}

test("manifest validation and capability version matching are strict", () => {
  assert.throws(() => validateManifest({ id: "Bad ID", version: "1" }), /plugin id/);
  assert.throws(() => validateManifest({ id: "valid", version: "1.0.0", provides: { cap: "latest" } }), /semantic version/);
  assert.equal(satisfiesVersion("1.4.2", "^1.2.0"), true);
  assert.equal(satisfiesVersion("2.0.0", "^1.2.0"), false);
  assert.equal(satisfiesVersion("1.4.2", "1.x"), true);
  assert.equal(satisfiesVersion("1.4.2", "1.4.2"), true);
});

test("plugins activate by capability dependency rather than input order", async () => {
  const order = [];
  const consumer = plugin({
    id: "consumer",
    version: "1.0.0",
    requires: { "math.v1": "^1.0.0" },
  }, ({ capabilities }) => {
    order.push("consumer");
    assert.equal(capabilities.require("math.v1").add(2, 3), 5);
  });
  const provider = plugin({
    id: "provider",
    version: "1.0.0",
    provides: { "math.v1": "1.1.0" },
  }, () => {
    order.push("provider");
    return { capabilities: { "math.v1": { add: (left, right) => left + right } } };
  });

  const host = new PluginHost();
  await host.activate([consumer, provider]);
  assert.deepEqual(order, ["provider", "consumer"]);
  assert.equal(host.capabilities.require("math.v1", "^1.0.0").add(4, 5), 9);
  await host.dispose();
  assert.throws(() => host.capabilities.require("math.v1"), /not available/);
});

test("a fake provider substitutes for a real plugin without changing the consumer", async () => {
  const observed = [];
  const consumer = plugin({
    id: "event-consumer",
    version: "1.0.0",
    requires: { "relay.events.v1": "^1.0.0" },
  }, ({ capabilities }) => {
    observed.push(capabilities.require("relay.events.v1").listWaits());
  });
  const fake = plugin({
    id: "fake-events",
    version: "1.0.0",
    provides: { "relay.events.v1": "1.0.0" },
  }, () => ({ capabilities: { "relay.events.v1": { listWaits: () => ["fake"] } } }));

  const host = new PluginHost();
  await host.activate([consumer, fake]);
  assert.deepEqual(observed, [["fake"]]);
  await host.dispose();
});

test("missing, incompatible, duplicate, and cyclic capabilities fail before activation", async () => {
  let activations = 0;
  const needsMissing = plugin({
    id: "needs-missing",
    version: "1.0.0",
    requires: { missing: "^1.0.0" },
  }, () => { activations += 1; });
  await assert.rejects(new PluginHost().activate([needsMissing]), /requires missing/);
  assert.equal(activations, 0);

  const oldProvider = plugin({ id: "old", version: "1.0.0", provides: { api: "1.0.0" } },
    () => ({ capabilities: { api: {} } }));
  const needsNew = plugin({ id: "new-consumer", version: "1.0.0", requires: { api: "^2.0.0" } },
    () => { activations += 1; });
  await assert.rejects(new PluginHost().activate([oldProvider, needsNew]), /requires api \^2\.0\.0/);
  assert.equal(activations, 0);

  const duplicate = plugin({ id: "duplicate", version: "1.0.0", provides: { api: "1.2.0" } },
    () => ({ capabilities: { api: {} } }));
  await assert.rejects(new PluginHost().activate([oldProvider, duplicate]), /provided by both/);

  const left = plugin({ id: "left", version: "1.0.0", provides: { left: "1.0.0" }, requires: { right: "^1.0.0" } },
    () => ({ capabilities: { left: {} } }));
  const right = plugin({ id: "right", version: "1.0.0", provides: { right: "1.0.0" }, requires: { left: "^1.0.0" } },
    () => ({ capabilities: { right: {} } }));
  await assert.rejects(new PluginHost().activate([left, right]), /dependency cycle/);
});

test("activation failure rolls back and normal disposal is reverse ordered", async () => {
  const events = [];
  const base = plugin({ id: "base", version: "1.0.0", provides: { base: "1.0.0" } }, () => ({
    capabilities: { base: {} },
    dispose: () => { events.push("dispose-base"); },
  }));
  const failing = plugin({ id: "failing", version: "1.0.0", requires: { base: "^1.0.0" } }, () => {
    events.push("activate-failing");
    throw new Error("activation exploded");
  });
  const host = new PluginHost();
  await assert.rejects(host.activate([failing, base]), /activation exploded/);
  assert.deepEqual(events, ["activate-failing", "dispose-base"]);
  assert.throws(() => host.capabilities.require("base"), /not available/);

  events.length = 0;
  const malformed = plugin({
    id: "malformed",
    version: "1.0.0",
    provides: { promised: "1.0.0" },
  }, () => ({
    capabilities: {},
    dispose: () => { events.push("dispose-malformed"); },
  }));
  await assert.rejects(new PluginHost().activate([malformed]), /provided capabilities/);
  assert.deepEqual(events, ["dispose-malformed"]);

  events.length = 0;
  const first = plugin({ id: "first", version: "1.0.0", provides: { first: "1.0.0" } }, () => ({
    capabilities: { first: {} }, dispose: () => { events.push("first"); },
  }));
  const second = plugin({ id: "second", version: "1.0.0", requires: { first: "^1.0.0" } }, () => ({
    dispose: () => { events.push("second"); },
  }));
  const normal = new PluginHost();
  await normal.activate([second, first]);
  await normal.dispose();
  assert.deepEqual(events, ["second", "first"]);
});

test("activation transactions clean partial resources and preserve the original failure", async () => {
  const events = [];
  const provider = plugin({
    id: "transaction-provider",
    version: "1.0.0",
    provides: { transaction: "1.0.0" },
  }, () => ({
    capabilities: { transaction: {} },
    dispose: () => { events.push("dispose-provider"); },
  }));
  const failing = plugin({
    id: "transaction-failing",
    version: "1.0.0",
    requires: { transaction: "^1.0.0" },
  }, ({ defer }) => {
    defer(() => { events.push("dispose-first"); });
    defer(() => {
      events.push("dispose-second");
      throw new Error("rollback also failed");
    });
    throw new Error("activation exploded");
  });

  const host = new PluginHost();
  await assert.rejects(host.activate([failing, provider]), (error) => {
    assert.match(error.message, /activation exploded/);
    assert.equal(error.cause?.message, "activation exploded");
    assert.ok(error instanceof AggregateError);
    return true;
  });
  assert.deepEqual(events, ["dispose-second", "dispose-first", "dispose-provider"]);
  assert.throws(() => host.capabilities.require("transaction"), /not available/);
});

test("normal disposal runs the returned disposer before deferred cleanups", async () => {
  const events = [];
  const transactional = plugin({ id: "transactional", version: "1.0.0" }, ({ defer }) => {
    defer(() => { events.push("deferred-first"); });
    defer(() => { events.push("deferred-second"); });
    return { dispose: () => { events.push("returned"); } };
  });

  const host = new PluginHost();
  await host.activate([transactional]);
  await host.dispose();
  assert.deepEqual(events, ["returned", "deferred-second", "deferred-first"]);
});

test("optional capabilities are ordered when present and undefined when absent", async () => {
  const values = [];
  const consumer = plugin({
    id: "optional-consumer",
    version: "1.0.0",
    optional: { feature: "^1.0.0" },
  }, ({ capabilities }) => { values.push(capabilities.optional("feature")?.value ?? null); });
  const provider = plugin({ id: "optional-provider", version: "1.0.0", provides: { feature: "1.0.0" } },
    () => ({ capabilities: { feature: { value: 42 } } }));

  const withProvider = new PluginHost();
  await withProvider.activate([consumer, provider]);
  await withProvider.dispose();
  const withoutProvider = new PluginHost();
  await withoutProvider.activate([consumer]);
  await withoutProvider.dispose();
  assert.deepEqual(values, [42, null]);
});
