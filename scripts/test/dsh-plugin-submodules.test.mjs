import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const plugins = [
  {
    path: "integrations/codex",
    url: "git@github.com:yangbobo2021/relay-dsh-plugin-codex.git",
    packageName: "@relay/dsh-plugin-codex",
  },
  {
    path: "integrations/claude",
    url: "git@github.com:yangbobo2021/relay-dsh-plugin-claude.git",
    packageName: "@relay/dsh-plugin-claude",
  },
];

test("Codex and Claude integrations are independently buildable Git submodules", async () => {
  const modules = await readFile(join(root, ".gitmodules"), "utf8");
  for (const plugin of plugins) {
    const stage = execFileSync("git", ["ls-files", "--stage", plugin.path], { cwd: root, encoding: "utf8" });
    assert.match(stage, /^160000 /, `${plugin.path} must be a Git submodule`);
    assert.match(modules, new RegExp(`path = ${escapeRegExp(plugin.path)}[\\s\\S]*url = ${escapeRegExp(plugin.url)}`));

    const directory = join(root, plugin.path);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    assert.equal(manifest.name, plugin.packageName);
    assert.ok(manifest.scripts?.test);
    assert.ok(manifest.scripts?.build);
    assert.ok(manifest.scripts?.["prepare:dsh"]);
    await access(join(directory, "package-lock.json"));
    await access(join(directory, ".gitignore"));

    const tracked = execFileSync("git", ["-C", directory, "ls-files"], { encoding: "utf8" })
      .trim().split("\n").filter(file => /\.(?:js|mjs|ts|tsx)$/.test(file));
    const source = (await Promise.all(tracked.map(file => readFile(join(directory, file), "utf8")))).join("\n");
    assert.doesNotMatch(source, /(?:\.\.\/){2,}packages\//, `${plugin.path} reaches into the Relay parent repository`);
    assert.doesNotMatch(source, /@relay\/plugin-sdk/, `${plugin.path} depends on the Relay monorepo SDK package`);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
