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
  ["packages/dsh-plugin-contracts", "@relay/dsh-plugin-contracts"],
  ["integrations/codex", "@relay/dsh-plugin-codex"],
  ["integrations/claude", "@relay/dsh-plugin-claude"],
  ["integrations/deepseek-harness", "@relay/plugin-events"],
  ["integrations/dsh-workbench", "@relay/dsh-plugin-workbench"],
  ["integrations/dsh-files", "@relay/dsh-plugin-files"],
  ["integrations/dsh-terminal", "@relay/dsh-plugin-terminal"],
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
    assert.ok(Object.keys(manifest.exports).every(key => !key.includes("*")), `${directory} cannot use wildcard exports`);
    assert.equal(Object.values(manifest.exports).some(value => String(value).includes("/src/")), false,
      `${directory} cannot export internal source paths`);
  }

  for (const directory of ["integrations/codex", "integrations/claude"]) {
    const manifest = await json(join(root, directory, "package.json"));
    assert.deepEqual(Object.keys(manifest.dependencies ?? {}).filter(name => name.startsWith("@relay/")), []);
    assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
  }

  const workbenchPatch = await readFile(join(root, "integrations/dsh-workbench/cordis.patch.yml"), "utf8");
  assert.match(workbenchPatch, /- id: ui-layout\n\s+disabled: true/, "Workbench owns its layout");
  for (const directory of ["integrations/codex", "integrations/claude", "integrations/deepseek-harness", "integrations/dsh-files", "integrations/dsh-terminal"]) {
    const patch = await readFile(join(root, directory, "cordis.patch.yml"), "utf8");
    assert.doesNotMatch(patch, /- id: ui-layout/, `${directory} must preserve the official DSH layout`);
  }
});

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
