import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("DSH synchronization uses the official repository as a detached read-only input", async () => {
  const script = await readFile(join(root, "scripts/sync-dsh.sh"), "utf8");

  assert.match(script, /dsh_url="https:\/\/github\.com\/deepseek-ai\/deepseek-harness\.git"/);
  assert.match(script, /remote set-url --push origin "\$disabled_push_url"/);
  assert.match(script, /remote prune origin/);
  assert.match(script, /fetch --depth 1 origin master/);
  assert.match(script, /checkout --detach FETCH_HEAD/);
  assert.match(script, /status --porcelain --untracked-files=all/);
  assert.doesNotMatch(script, /yangbobo2021|relay\/main/);
});

test("the normative DSH boundary forbids source patches and Fork dependencies", async () => {
  const specification = await readFile(join(root, "docs/spec/dsh-upstream-boundary.md"), "utf8");

  assert.match(specification, /MUST NOT:\n\n- edit, add, delete, or rename tracked files/);
  assert.match(specification, /MUST NOT be replaced by a Fork/);
  assert.match(specification, /Relay's official reference checkout has no contribution exception/);
  assert.match(specification, /integrations\/deepseek-harness\//);
});

test("the web launcher resolves Relay packages through the root workspace", async () => {
  const script = await readFile(join(root, "scripts/start-relay-web.sh"), "utf8");

  assert.match(script, /npm install --ignore-scripts/);
  assert.match(script, /node_modules\/\.bin\/tsdown/);
  assert.match(script, /pnpm --dir "\$dsh_root" install --ignore-scripts --frozen-lockfile/);
  assert.match(script, /packages\/settings\/settings-file\/node_modules\/chokidar/);
  assert.match(script, /packages\/host\/apiproxy\/node_modules\/fflate/);
  assert.match(script, /repair-dsh-workspace-links\.mjs/);
  assert.doesNotMatch(script, /pnpm --dir "\$plugin_root" install/);
  assert.match(script, /legacy_packages=\(/);
  for (const name of ["relay-dsh-plugin", "@relay/dsh-core", "@relay/dsh-codex", "@relay/dsh-claude"]) {
    assert.match(script, new RegExp(name.replace("/", "\\/")));
  }
  assert.ok(
    script.indexOf('npm install --ignore-scripts') < script.indexOf('repair-dsh-workspace-links.mjs'),
    "Relay dependency installation must finish before official workspace repair",
  );
  assert.ok(
    script.indexOf('legacy_packages=(') < script.indexOf('plugin --profile web add'),
    "legacy Relay plugins must be removed before renamed packages are added",
  );
});
