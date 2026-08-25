import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const relayRoot = resolve(import.meta.dirname, "../..");
const rawRoot = resolve(import.meta.dirname, "raw");

const probes = [
  {
    id: "pure-1",
    command: process.execPath,
    args: ["dsh-lab/codex-session-import/pure-probe.mjs"],
    cwd: relayRoot,
    parse: "json",
  },
  {
    id: "pure-2",
    command: process.execPath,
    args: ["dsh-lab/codex-session-import/pure-probe.mjs"],
    cwd: relayRoot,
    parse: "json",
  },
  {
    id: "dsh-1",
    command: "./node_modules/.bin/tsx",
    args: ["--tsconfig", "tsconfig.host.json", "../../dsh-lab/codex-session-import/dsh-import-probe.ts"],
    cwd: resolve(relayRoot, "upstream/deepseek-harness"),
    parse: "json",
  },
  {
    id: "dsh-2",
    command: "./node_modules/.bin/tsx",
    args: ["--tsconfig", "tsconfig.host.json", "../../dsh-lab/codex-session-import/dsh-import-probe.ts"],
    cwd: resolve(relayRoot, "upstream/deepseek-harness"),
    parse: "json",
  },
  {
    id: "live-1",
    command: process.execPath,
    args: ["dsh-lab/codex-session-import/live-app-server-probe.mjs"],
    cwd: relayRoot,
    parse: "json",
  },
  {
    id: "live-2",
    command: process.execPath,
    args: ["dsh-lab/codex-session-import/live-app-server-probe.mjs"],
    cwd: relayRoot,
    parse: "json",
  },
  {
    id: "version-compat",
    command: process.execPath,
    args: ["dsh-lab/codex-session-import/version-compat-probe.mjs"],
    cwd: relayRoot,
    parse: "json",
  },
  {
    id: "plugin-verify",
    command: "npm",
    args: ["run", "verify"],
    cwd: resolve(relayRoot, "integrations/codex"),
    parse: "command",
  },
  {
    id: "dsh-bundle",
    command: "npm",
    args: ["run", "experiment:dsh-bundle"],
    cwd: relayRoot,
    parse: "command",
  },
  {
    id: "dsh-cold-resume",
    command: "npm",
    args: ["run", "experiment:dsh-cold-resume"],
    cwd: relayRoot,
    parse: "command",
  },
];

await rm(rawRoot, { recursive: true, force: true });
await mkdir(rawRoot, { recursive: true });

for (const probe of probes) {
  const startedAt = new Date().toISOString();
  const execution = await run(probe.command, probe.args, probe.cwd);
  const completedAt = new Date().toISOString();
  assert.equal(execution.code, 0, `${probe.id} failed: stderr sha256 ${sha256(execution.stderr)}`);
  const result = probe.parse === "json"
    ? JSON.parse(execution.stdout)
    : commandSummary(probe.id, execution.stdout);
  const record = {
    schemaVersion: 1,
    id: probe.id,
    startedAt,
    completedAt,
    command: displayCommand(probe),
    cwd: displayCwd(probe.cwd),
    exitCode: execution.code,
    stdoutSha256: sha256(execution.stdout),
    stderrSha256: sha256(execution.stderr),
    result,
  };
  await writeFile(resolve(rawRoot, `${probe.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`${probe.id}: pass\n`);
}

function commandSummary(id, stdout) {
  if (id === "plugin-verify") {
    return {
      passed: true,
      tests: Number(/tests\s+(\d+)/.exec(stdout)?.[1] ?? 0),
      passedTests: Number(/pass\s+(\d+)/.exec(stdout)?.[1] ?? 0),
      failedTests: Number(/fail\s+(\d+)/.exec(stdout)?.[1] ?? 0),
      buildCompleted: /Build complete/.test(stdout),
    };
  }
  const jsonStart = stdout.indexOf("{");
  return {
    passed: true,
    details: jsonStart >= 0 ? JSON.parse(stdout.slice(jsonStart)) : {},
  };
}

function displayCommand(probe) {
  const executable = probe.command === process.execPath ? "node" : probe.command;
  return [executable, ...probe.args].join(" ");
}

function displayCwd(cwd) {
  if (cwd === relayRoot) return ".";
  return cwd.slice(relayRoot.length + 1);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", code => resolveRun({ code, stdout, stderr }));
  });
}
