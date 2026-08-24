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
    packageName: "relay-dsh-plugin-codex",
  },
  {
    path: "integrations/claude",
    url: "git@github.com:yangbobo2021/relay-dsh-plugin-claude.git",
    packageName: "relay-dsh-plugin-claude",
  },
  {
    path: "integrations/dsh-workbench",
    url: "git@github.com:yangbobo2021/relay-dsh-plugin-workbench.git",
    packageName: "@relay/dsh-plugin-workbench",
  },
  {
    path: "integrations/dsh-files",
    url: "git@github.com:yangbobo2021/relay-dsh-plugin-files.git",
    packageName: "@relay/dsh-plugin-files",
  },
  {
    path: "integrations/dsh-terminal",
    url: "git@github.com:yangbobo2021/relay-dsh-plugin-terminal.git",
    packageName: "@relay/dsh-plugin-terminal",
  },
];

test("DSH integrations are independently buildable Git submodules", async () => {
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

    const tracked = execFileSync("git", ["-C", directory, "ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
      .trim().split("\n").filter(file => /\.(?:js|mjs|ts|tsx)$/.test(file));
    const source = (await Promise.all(tracked.map(file => readFile(join(directory, file), "utf8").catch(error => {
      if (error.code === "ENOENT") return "";
      throw error;
    })))).join("\n");
    assert.doesNotMatch(source, /(?:\.\.\/){2,}packages\//, `${plugin.path} reaches into the Relay parent repository`);
    assert.doesNotMatch(source, /@relay\/plugin-sdk/, `${plugin.path} depends on the Relay monorepo SDK package`);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
