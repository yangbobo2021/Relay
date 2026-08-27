import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const publishableVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const dshRcCompatibility = ">=0.1.0-rc.5 <0.1.1 || >=0.1.1-rc.0 <0.2.0";
const expected = new Map([
  ["packages/plugin-sdk", "@relay/plugin-sdk"],
  ["packages/event-router", "@relay/event-router"],
  ["packages/runtime", "@relay/runtime"],
  ["packages/monitor-runtime", "@relay/monitor-runtime"],
  ["packages/event-runtime-plugin", "@relay/plugin-event-runtime"],
  ["packages/dsh-plugin-contracts", "@relay/dsh-plugin-contracts"],
  ["integrations/codex", "relay-dsh-plugin-codex"],
  ["integrations/claude", "relay-dsh-plugin-claude"],
  ["integrations/deepseek-harness", "@relay/plugin-events"],
  ["integrations/dsh-workbench", "relay-dsh-plugin-workbench"],
  ["integrations/dsh-files", "relay-dsh-plugin-files"],
  ["integrations/dsh-terminal", "relay-dsh-plugin-terminal"],
  ["integrations/dsh-plugin-manager", "relay-dsh-plugin-manager"],
]);

test("plugins and shared libraries are independently publishable workspace packages", async () => {
  const rootManifest = await json(join(root, "package.json"));
  assert.deepEqual(new Set(rootManifest.workspaces), new Set(expected.keys()));

  for (const [directory, name] of expected) {
    const manifest = await json(join(root, directory, "package.json"));
    assert.equal(manifest.name, name, directory);
    assert.notEqual(manifest.private, true, `${directory} must be packable for a future repository split`);
    assert.match(manifest.version, publishableVersion, directory);
    assert.equal(manifest.type, "module", directory);
    assert.ok(manifest.exports && typeof manifest.exports === "object", `${directory} needs exports`);
    assert.ok(Object.keys(manifest.exports).every(key => !key.includes("*")), `${directory} cannot use wildcard exports`);
    assert.equal(Object.values(manifest.exports).some(value => String(value).includes("/src/")), false,
      `${directory} cannot export internal source paths`);
  }

  for (const directory of ["integrations/codex", "integrations/claude"]) {
    const manifest = await json(join(root, directory, "package.json"));
    assert.deepEqual(Object.keys(manifest.dependencies ?? {}).filter(isRelayPackage), []);
    assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
  }

  const eventsManifest = await json(join(root, "integrations/deepseek-harness/package.json"));
  for (const dependency of ["@deepseek-ai/dsh-llm", "@deepseek-ai/dsh-session",
    "@deepseek-ai/dsh-tools", "@deepseek-ai/dsh-typert-protocol"]) {
    assert.equal(eventsManifest.peerDependencies?.[dependency], dshRcCompatibility,
      `Events ${dependency} peer must include both supported DSH RC version lines`);
  }

  for (const directory of ["integrations/dsh-workbench", "integrations/dsh-files", "integrations/dsh-terminal"]) {
    const patch = await readFile(join(root, directory, "cordis.patch.yml"), "utf8");
    assert.match(patch, /- id: ui-layout\n\s+disabled: true/, `${directory} activates the Workbench layout`);
  }
  for (const directory of ["integrations/dsh-files", "integrations/dsh-terminal"]) {
    const manifest = await json(join(root, directory, "package.json"));
    assert.equal(manifest.dependencies?.["relay-dsh-plugin-workbench"], undefined,
      `${directory} must not use a GitHub Workbench subdependency because DSH profiles block exotic subdependencies`);
    assert.equal(manifest.peerDependencies?.["relay-dsh-plugin-workbench"], "^0.1.0",
      `${directory} must declare the Workbench peer contract`);
    assert.equal(manifest.devDependencies?.["relay-dsh-plugin-workbench"], "github:yangbobo2021/relay-dsh-plugin-workbench#main",
      `${directory} may use GitHub Workbench only as a local development dependency`);
    const patch = await readFile(join(root, directory, "cordis.patch.yml"), "utf8");
    assert.doesNotMatch(patch, /- id: relay-workbench-host\n/, `${directory} must not reuse Workbench's direct-install loader id`);
  }
  for (const directory of ["integrations/codex", "integrations/claude", "integrations/deepseek-harness", "integrations/dsh-plugin-manager"]) {
    const patch = await readFile(join(root, directory, "cordis.patch.yml"), "utf8");
    assert.doesNotMatch(patch, /- id: ui-layout/, `${directory} must preserve the official DSH layout`);
  }
});

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isRelayPackage(name) {
  return name.startsWith("@relay/") || name.startsWith("relay-dsh-plugin-");
}
