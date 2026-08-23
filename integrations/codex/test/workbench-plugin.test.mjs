import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { CODEX_DESCRIPTORS } from "../remote-schema.js";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Codex owns terminal and workspace Remote contracts", () => {
  assert.deepEqual(
    [...new Set(CODEX_DESCRIPTORS.map(descriptor => descriptor.service))],
    ["relayWorkbenchTerminal", "relayWorkspaceFiles"],
  );
  assert.equal(CODEX_DESCRIPTORS.length, 7);
  for (const descriptor of CODEX_DESCRIPTORS) {
    assert.match(descriptor.id, /^relay-plugin-codex#/);
    assert.equal(descriptor.namespace, descriptor.service);
    assert.equal(descriptor.invocation.kind, "direct");
    assert.equal(descriptor.result.mode, "strict");
  }
});

test("the Codex distributable contains only built artifacts and its preset", async () => {
  const manifest = JSON.parse(await readFile(join(pluginRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, "@relay/plugin-codex");
  for (const artifact of ["cordis.patch.yml", "presets", "lib/client.js", "lib/host-plugin.js", "lib/typert.host.js"]) {
    assert.ok(manifest.files.includes(artifact), artifact);
  }
  assert.equal(manifest.files.some(file => file.startsWith("src/")), false);
  assert.deepEqual(Object.keys(manifest.dependencies).filter(name => name.startsWith("@relay/")), []);
});

test("Codex replaces only the workbench layout extension surface", async () => {
  const patch = await readFile(join(pluginRoot, "cordis.patch.yml"), "utf8");
  assert.match(patch, /- id: ui-layout\n\s+disabled: true/);
  assert.match(patch, /name: '@relay\/plugin-codex'/);
  assert.doesNotMatch(patch, /relay-runtime-host|plugin-events/);
});

test("the Codex client owns layout, files, terminal, and activity", async () => {
  const source = await readFile(join(pluginRoot, "src/client/index.ts"), "utf8");
  assert.match(source, /applyWorkbenchLayout/);
  assert.match(source, /applyFileExplorer/);
  assert.match(source, /applyWebTerminal/);
  assert.match(source, /CodexActivityView/);
  assert.doesNotMatch(source, /WaitingEvents|relay\.management/);
});
