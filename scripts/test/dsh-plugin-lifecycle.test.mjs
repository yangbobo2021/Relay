import assert from "node:assert/strict";
import test from "node:test";

import { acquireDshCore, inspectDshCore } from "@relay/dsh-core/lifecycle";

test("Codex and Claude consumers share one compatible Core until the final release", async () => {
  const root = {};
  let activations = 0;
  let disposals = 0;
  const activate = async () => {
    activations += 1;
    return { value: { id: "core" }, dispose: async () => { disposals += 1; } };
  };

  const codex = await acquireDshCore(root, { range: "^1.0.0", activate });
  const claude = await acquireDshCore(root, { range: "^1.0.0", activate });
  assert.equal(codex.value, claude.value);
  assert.equal(activations, 1);
  assert.deepEqual(inspectDshCore(root), { version: "1.0.0", consumers: 2 });

  await codex.release();
  assert.deepEqual(inspectDshCore(root), { version: "1.0.0", consumers: 1 });
  assert.equal(disposals, 0);
  await claude.release();
  assert.equal(inspectDshCore(root), undefined);
  assert.equal(disposals, 1);
});

test("an incompatible Core acquisition fails without changing ownership", async () => {
  const root = {};
  const first = await acquireDshCore(root, {
    range: "^1.0.0",
    activate: async () => ({ value: {}, dispose: async () => {} }),
  });
  await assert.rejects(
    acquireDshCore(root, {
      range: "^2.0.0",
      activate: async () => { throw new Error("must not activate"); },
    }),
    /Core 1\.0\.0 does not satisfy \^2\.0\.0/,
  );
  assert.deepEqual(inspectDshCore(root), { version: "1.0.0", consumers: 1 });
  await first.release();
});

test("failed Core activation is transactional and can be retried", async () => {
  const root = {};
  await assert.rejects(
    acquireDshCore(root, { range: "^1.0.0", activate: async () => { throw new Error("boom"); } }),
    /boom/,
  );
  assert.equal(inspectDshCore(root), undefined);
  const retry = await acquireDshCore(root, {
    range: "^1.0.0",
    activate: async () => ({ value: {}, dispose: async () => {} }),
  });
  assert.deepEqual(inspectDshCore(root), { version: "1.0.0", consumers: 1 });
  await retry.release();
});
