import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { RELAY_DESCRIPTORS } from "../remote-schema.js";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the workbench Remote contract stays inside the Relay plugin namespace", () => {
  assert.deepEqual(
    [...new Set(RELAY_DESCRIPTORS.map((descriptor) => descriptor.service))],
    ["relayManagement", "relayWorkspaceFiles"],
  );
  assert.equal(RELAY_DESCRIPTORS.length, 5);
  for (const descriptor of RELAY_DESCRIPTORS) {
    assert.match(descriptor.id, /^relay-dsh-core#/);
    assert.equal(descriptor.namespace, descriptor.service);
    assert.equal(descriptor.invocation.kind, "direct");
    assert.equal(descriptor.result.mode, "strict");
  }
});

test("the distributable contains built plugin artifacts, not Relay or DSH source trees", async () => {
  const manifest = JSON.parse(await readFile(join(pluginRoot, "package.json"), "utf8"));
  assert.equal(manifest.main, "lib/host-plugin.js");
  assert.equal(manifest.exports["./client"], "./lib/client.js");
  assert.equal(manifest.exports["./typert"], "./lib/typert.host.js");
  for (const artifact of ["cordis.patch.yml", "lifecycle.mjs", "client-api.d.ts", "client-types.d.ts", "lib/client.js", "lib/host-plugin.js", "lib/runtime.js", "lib/client-api.js", "lib/typert.host.js"]) {
    assert.ok(manifest.files.includes(artifact), artifact);
  }
  assert.equal(manifest.files.some((file) => file.startsWith("src/")), false);
  assert.equal(manifest.files.some((file) => file.includes("upstream/")), false);
});

test("the Relay profile replaces only the missing workbench extension surface", async () => {
  const patch = await readFile(join(pluginRoot, "cordis.patch.yml"), "utf8");
  assert.match(patch, /- id: ui-layout\n\s+disabled: true/);
  assert.match(patch, /name: '@relay\/dsh-core'/);
  assert.doesNotMatch(patch, /ui-file-explorer|ui-web-terminal|terminal-bash/);
});

test("the Core client owns workspace and management without backend UI", async () => {
  const source = await readFile(join(pluginRoot, "src/client/core.ts"), "utf8");
  assert.doesNotMatch(source, /CodexActivity|ClaudeActivity|WorkbenchTerminal/);
  assert.match(source, /if \(remote !== undefined\)/);
});
