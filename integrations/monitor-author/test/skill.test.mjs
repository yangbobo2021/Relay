import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("MB08-005/006/007: Skill enforces live discovery, plugin preference, validation receipt, and fail-closed reporting", async () => {
  const text = await readFile(join(root, "skills/relay-monitor-author/SKILL.md"), "utf8");
  const list = text.indexOf("relay_list_monitor_bundle_types");
  const create = text.indexOf("relay_create_monitor_from_type");
  const validate = text.indexOf("relay_validate_monitor_bundle");
  const install = text.indexOf("relay_install_monitor_bundle");
  assert.ok(list >= 0 && create > list && validate > create && install > validate);
  assert.match(text, /Never claim success/u);
  assert.match(text, /Report success only from the install result/u);
  assert.match(text, /never grant or poll a raw PID/u);
  assert.match(text, /en-US.*zh-CN/su);
  assert.match(text, /scope: session/u);
  assert.match(text, /scope: project/u);
  assert.match(text, /relay_update_monitor_bundle/u);
  assert.match(text, /relay_rollback_monitor_bundle/u);
});

test("MB10 packaging: plugin manifest exposes exactly the bundled Skill directory", async () => {
  const manifest = JSON.parse(await readFile(join(root, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(manifest.name, "relay-monitor-author");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.interface.capabilities.length, 0);
});
