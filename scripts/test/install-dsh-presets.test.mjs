import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "../..");
const installer = join(root, "scripts/install-dsh-presets.sh");

test("the DSH preset installer installs and refreshes Codex and Claude presets", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "relay-presets-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  await execFileAsync(installer, { env: { ...process.env, DSH_HOME: directory } });

  for (const preset of ["relay-codex", "relay-claude"]) {
    const installed = join(directory, ".agent-presets", preset);
    assert.match(await readFile(join(installed, "preset.yml"), "utf8"), /name:/);
    assert.match(await readFile(join(installed, ".relay-managed"), "utf8"), /Managed by Relay/);
  }

  const claudePreset = join(directory, ".agent-presets", "relay-claude", "preset.yml");
  await writeFile(claudePreset, "stale\n");
  await execFileAsync(installer, { env: { ...process.env, DSH_HOME: directory } });
  assert.match(await readFile(claudePreset, "utf8"), /name: Claude Code/);
});

test("the DSH preset installer preserves an unmanaged preset", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "relay-presets-unmanaged-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, ".agent-presets", "relay-claude");
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "preset.yml"), "name: Custom Claude\n");

  const result = await execFileAsync(installer, { env: { ...process.env, DSH_HOME: directory } });

  assert.match(result.stderr, /already exists and is not Relay-managed/);
  assert.equal(await readFile(join(target, "preset.yml"), "utf8"), "name: Custom Claude\n");
});
