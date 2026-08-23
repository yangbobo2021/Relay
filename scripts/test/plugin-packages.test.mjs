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
  ["integrations/deepseek-harness", "@relay/dsh-core"],
  ["integrations/dsh-codex", "@relay/dsh-codex"],
  ["integrations/dsh-claude", "@relay/dsh-claude"],
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
  const core = await json(join(root, "integrations/deepseek-harness/package.json"));
  assert.equal(core.dependencies["@relay/plugin-sdk"], "0.1.0");
  assert.equal(core.dependencies["@relay/plugin-event-runtime"], "0.1.0");

  const codex = await json(join(root, "integrations/dsh-codex/package.json"));
  assert.equal(codex.dependencies["@relay/dsh-core"], "0.1.0");
  assert.equal(codex.dependencies["@relay/plugin-codex"], "0.1.0");

  const claude = await json(join(root, "integrations/dsh-claude/package.json"));
  assert.equal(claude.dependencies["@relay/dsh-core"], "0.1.0");
  assert.equal(claude.dependencies["@relay/plugin-claude"], "0.1.0");

  for (const entry of [
    "integrations/deepseek-harness/src/client/index.ts",
    "integrations/dsh-codex/src/client/index.ts",
    "integrations/dsh-claude/src/client/index.ts",
  ]) {
    const source = await readFile(join(root, entry), "utf8");
    assert.match(source, /acquireDshCoreClient/, `${entry} must share the Core client lifecycle`);
  }
  const coreClientLifecycle = await readFile(join(root, "integrations/deepseek-harness/src/client/api.ts"), "utf8");
  assert.match(coreClientLifecycle, /root\.plugin\(/, "Core client must own an independently disposable Fiber");
  assert.match(coreClientLifecycle, /inject:\s*\[\.\.\.inject\]/, "Core client Fiber must declare the services used by Core");
  assert.match(coreClientLifecycle, /fiber\.dispose\(\)/, "Core client final release must dispose every shared effect");

  for (const directory of ["integrations/dsh-codex", "integrations/dsh-claude"]) {
    const manifest = await json(join(root, directory, "package.json"));
    for (const clientDependency of [
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-settings",
      "@deepseek-ai/dsh-client-ui-theme",
    ]) assert.ok(manifest.dsh.client.inject.includes(clientDependency), `${directory} must carry Core client dependencies`);
    const patch = await readFile(join(root, directory, "cordis.patch.yml"), "utf8");
    assert.match(patch, /- id: ui-layout\n\s+disabled: true/, `${directory} must reserve the Core workbench layout`);
  }
});

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
