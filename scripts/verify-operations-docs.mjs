#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dshRoot = resolve(process.env.DSH_ROOT ?? join(root, "upstream", "deepseek-harness"));
const document = await readFile(join(root, "docs", "event-productization-operations.md"), "utf8");
const allBash = [...document.matchAll(/~~~bash\n([\s\S]*?)\n~~~/gu)];
const marked = [...document.matchAll(/<!-- relay-doc-test -->\s*\n~~~bash\n([\s\S]*?)\n~~~/gu)];
assert.ok(marked.length >= 5, "operations guide must cover build, configure, install/doctor, upgrade, and uninstall");
assert.equal(marked.length, allBash.length, "every published bash block must be a docs-as-tests block");

const temporary = await mkdtemp(join(tmpdir(), "relay-operations-docs-"));
const dshHome = join(temporary, "dsh-home");
const artifacts = join(temporary, "artifacts");
const before = gitStatus(dshRoot);
try {
  const script = ["set -euo pipefail", ...marked.flatMap((match, index) => [
    `print -r -- DOC_TEST_BLOCK_${index + 1}`,
    match[1],
  ])].join("\n\n");
  const result = spawnSync("/bin/zsh", ["-f"], {
    cwd: root,
    input: script,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: temporary,
      LANG: "C",
      LC_ALL: "C",
      RELAY_REPOSITORY_ROOT: root,
      DSH_ROOT: dshRoot,
      DSH_HOME: dshHome,
      RELAY_ARTIFACT_DIR: artifacts,
      RELAY_NOTIFICATION_PROVIDER: "acceptance",
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const output = redact(`${result.stdout}\n${result.stderr}`);
    throw new Error(`documented command sequence failed with status ${result.status}\n${output.slice(-20_000)}`);
  }

  const expectedTarballs = [
    "relay-dsh-plugin-email-0.1.0.tgz",
    "relay-dsh-plugin-events-0.2.2.tgz",
    "relay-dsh-plugin-github-0.2.0.tgz",
    "relay-dsh-plugin-monitors-0.3.1.tgz",
    "relay-dsh-plugin-semantic-router-0.2.2.tgz",
  ];
  assert.deepEqual((await readdir(artifacts)).sort(), expectedTarballs);
  for (const name of ["relay-doctor.json", "relay-doctor-after-upgrade.json"]) {
    const report = JSON.parse(await readFile(join(dshHome, name), "utf8"));
    assert.equal(report.status, "healthy", `${name} must report release readiness`);
    const probe = report.checks.find(check => check.id === "probe.disposable");
    assert.equal(probe?.status, "healthy", `${name} must execute the disposable probe`);
    assert.equal(probe.details.cleanup, "completed");
  }
  const profile = JSON.parse(await readFile(join(dshHome, "profiles", "web", "package.json"), "utf8"));
  assert.deepEqual(Object.keys(profile.dependencies ?? {}).filter(name => name.startsWith("relay-dsh-plugin-")), [],
    "the documented uninstall must remove every Event product plugin");
  assert.equal(gitStatus(dshRoot), before, "documentation execution changed the immutable official DSH checkout");
  console.log(JSON.stringify({
    schema_version: 1,
    passed: true,
    dsh_commit: gitHead(dshRoot),
    blocks_executed: marked.length,
    tarballs: expectedTarballs,
    doctor_reports: 2,
    uninstall_verified: true,
  }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function gitStatus(directory) {
  const result = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function gitHead(directory) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function redact(value) {
  return value
    .replace(/release-test-[A-Za-z0-9_-]+/gu, "[REDACTED]")
    .replace(/Bearer\s+[^\s'"<>]+/giu, "Bearer [REDACTED]");
}
