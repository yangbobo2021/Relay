import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { SkillRegistry } from "@deepseek-ai/dsh-skill";
import * as authorPlugin from "../host-plugin.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("MA-002/003/004/005: DSH discovers, loads, and unloads the bundled Author Skill", async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  await ctx.plugin(SkillRegistry);
  ctx.skills.register({
    name: "unrelated-skill",
    description: "Lifecycle isolation fixture.",
    source: "runtime",
    content: "This Skill must survive Author plugin disposal.",
  });
  const installed = ctx.plugin(authorPlugin);
  await installed;

  const catalog = await ctx.skills.list({ cwd: root });
  assert.deepEqual(catalog.map(skill => skill.name), ["relay-monitor-author", "unrelated-skill"]);
  const author = catalog[0];
  assert.deepEqual(author.invocation, { modelInvocable: true, userInvocable: true });
  assert.equal(author.provider, "relay-monitor-author");
  assert.equal(author.source, "bundled");
  assert.match(author.description, /DeepSeek Harness|DSH/u);
  assert.match(author.description, /当前 DSH 会话/u);

  const skill = await ctx.skills.get("relay-monitor-author", { cwd: root });
  assert.equal(skill.resourceBase.kind, "directory");
  assert.equal(resolve(skill.resourceBase.path), join(root, "assets"));
  assert.match(skill.content, /^# Relay Monitor Author/mu);
  assert.match(skill.content, /relay_install_monitor_bundle/u);
  const provider = authorPlugin.createMonitorAuthorSkillProvider();
  assert.equal(await provider.get({ ...author, provider: "stale-provider" }), undefined);

  await installed.dispose();
  assert.deepEqual((await ctx.skills.list({ cwd: root })).map(entry => entry.name), ["unrelated-skill"]);
});

test("MA-006/007/008: instructions enforce DSH discovery, exact validation, and fail-closed reporting", async () => {
  const text = await readFile(join(root, "assets/relay-monitor-author.md"), "utf8");
  const list = text.indexOf("relay_list_monitor_bundle_types");
  const create = text.indexOf("relay_create_monitor_from_type");
  const validate = text.indexOf("relay_validate_monitor_bundle");
  const install = text.indexOf("relay_install_monitor_bundle");
  assert.ok(list >= 0 && create > list && validate > create && install > validate);
  assert.match(text, /Do not generate a custom Bundle in this case/u);
  assert.match(text, /Never claim success/u);
  assert.match(text, /Report success only from the install result/u);
  assert.match(text, /never grant or poll a raw PID/u);
  assert.match(text, /en-US.*zh-CN/su);
  assert.match(text, /scope: session/u);
  assert.match(text, /scope: project/u);
  assert.match(text, /missing Relay Monitor tools/u);
  assert.match(text, /relay_update_monitor_bundle/u);
  assert.match(text, /relay_rollback_monitor_bundle/u);
});

test("MA-001/010: packed artifact is a DSH plugin and contains no Codex plugin metadata", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(manifest.name, "relay-dsh-plugin-monitor-author");
  assert.equal(manifest.main, "./host-plugin.js");
  assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.scripts.preinstall, undefined);
  assert.equal(manifest.scripts.install, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
  const patch = await readFile(join(root, "cordis.patch.yml"), "utf8");
  assert.match(patch, /relay-dsh-plugin-monitor-author/u);
  assert.doesNotMatch(patch, /codex/iu);

  const packed = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--dry-run", "--json"], {
    cwd: root, encoding: "utf8",
  }))[0];
  const paths = packed.files.map(file => file.path);
  assert.ok(paths.includes("host-plugin.js"));
  assert.ok(paths.includes("cordis.patch.yml"));
  assert.ok(paths.includes("assets/relay-monitor-author.md"));
  assert.ok(paths.includes("assets/process-exit.md"));
  assert.equal(paths.some(path => path.startsWith(".codex-plugin/")), false);
  assert.equal(paths.some(path => /(?:^|\/)(?:node_modules|\.env)(?:\/|$)/u.test(path)), false);
});
