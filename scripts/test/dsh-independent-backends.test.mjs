import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

async function manifest(directory) {
  return JSON.parse(await readFile(join(root, directory, "package.json"), "utf8"));
}

async function source(directory, file) {
  return readFile(join(root, directory, file), "utf8");
}

test("Codex and Claude are self-contained DSH plugins without Relay plugin dependencies", async () => {
  for (const [directory, name] of [
    ["integrations/codex", "@relay/dsh-plugin-codex"],
    ["integrations/claude", "@relay/dsh-plugin-claude"],
  ]) {
    const pkg = await manifest(directory);
    assert.equal(pkg.name, name);
    assert.ok(pkg.dsh?.bundle?.patch, `${name} must be directly installable as a DSH bundle`);
    assert.deepEqual(
      Object.keys(pkg.dependencies ?? {}).filter(dependency => dependency.startsWith("@relay/")),
      [],
      `${name} must not require another Relay package at runtime`,
    );
    const sources = await Promise.all([
      "host-plugin.js", "dsh-plugin.js", directory.endsWith("codex") ? "codex-adapter.js" : "claude-adapter.js",
    ].map(file => source(directory, file)));
    assert.doesNotMatch(sources.join("\n"), /relay\.events|relay\.monitors|relay_register_waits|relay_cancel_waits/);
  }
});

test("Events is an optional provider-neutral DSH plugin", async () => {
  const pkg = await manifest("integrations/deepseek-harness");
  assert.equal(pkg.name, "@relay/plugin-events");
  assert.ok(pkg.dsh?.bundle?.patch);
  const composition = await source("integrations/deepseek-harness", "dsh-plugin.js");
  assert.match(composition, /ctx\.agents\.roots\(\)/, "Events must attach to every root DSH conversation");
  assert.doesNotMatch(composition, /codex|claude/i, "Events must not know execution backend names");
});

test("Workbench surfaces are independent from conversation and Events plugins", async () => {
  const codex = await source("integrations/codex", "src/client/index.ts");
  const events = await source("integrations/deepseek-harness", "src/client/index.ts");
  const workbench = await source("integrations/dsh-workbench", "src/client/layout/index.ts");
  assert.doesNotMatch(codex, /workbench|WorkspaceFiles|WebTerminal/);
  assert.doesNotMatch(events, /workbench|WorkspaceFiles/);
  assert.match(workbench, /workbench\.side\.view/);
  assert.match(workbench, /workbench\.bottom\.view/);
});

test("Codex contributes terminal transport only through the optional Cordis provider service", async () => {
  const codexHost = await source("integrations/codex", "dsh-plugin.js");
  assert.match(codexHost, /ctx\.inject\(\["relayTerminalProviders"\]/);
  assert.match(codexHost, /apiVersion !== 1/);
  assert.doesNotMatch(codexHost, /@relay\/dsh-plugin-(?:terminal|workbench|files)/);
});
