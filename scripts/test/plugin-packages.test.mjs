import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const expected = new Map([
  ["packages/plugin-sdk", "@relay/plugin-sdk"],
  ["packages/event-router", "@relay/event-router"],
  ["packages/runtime", "@relay/runtime"],
  ["packages/monitor-runtime", "@relay/monitor-runtime"],
  ["packages/event-runtime-plugin", "@relay/plugin-event-runtime"],
  ["integrations/codex", "@relay/plugin-codex"],
  ["integrations/claude", "@relay/plugin-claude"],
  ["integrations/deepseek-harness", "relay-dsh-plugin"],
]);

test("plugins and shared libraries are independently publishable workspace packages", async () => {
  const rootManifest = await json(join(root, "package.json"));
  assert.deepEqual(new Set(rootManifest.workspaces), new Set(expected.keys()));

  for (const [directory, name] of expected) {
    const manifest = await json(join(root, directory, "package.json"));
    assert.equal(manifest.name, name, directory);
    assert.notEqual(manifest.private, true, `${directory} must be packable for a future repository split`);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/, directory);
    assert.equal(manifest.type, "module", directory);
    assert.ok(manifest.exports && typeof manifest.exports === "object", `${directory} needs exports`);
    assert.ok(Object.keys(manifest.exports).every((key) => !key.includes("*")), `${directory} cannot use wildcard exports`);
    assert.equal(Object.values(manifest.exports).some((value) => String(value).includes("/src/")), false,
      `${directory} cannot export internal source paths`);
  }

  assert.equal(rootManifest.scripts["test:package:plugins"], "node scripts/verify-plugin-packages.mjs");
  const dsh = await json(join(root, "integrations/deepseek-harness/package.json"));
  for (const dependency of [
    "@relay/plugin-sdk",
    "@relay/plugin-event-runtime",
    "@relay/plugin-codex",
    "@relay/plugin-claude",
  ]) {
    assert.equal(dsh.devDependencies[dependency], "0.1.0", `DSH source build must declare ${dependency}`);
  }
});

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
