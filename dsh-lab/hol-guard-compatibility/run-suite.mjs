import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [guard, destination] = process.argv.slice(2);
assert.ok(guard && destination, "Usage: node run-suite.mjs /isolated/bin/hol-guard /private/artifacts");
const output = resolve(destination);
mkdirSync(output, { recursive: true });
const probe = join(dirname(fileURLToPath(import.meta.url)), "probe.mjs");
const cases = [
  ["dsh-control", "rm -r ./hol-guard-smoke", false, "dsh-control"],
  ["original-untrusted", "rm -rf ~/hol-guard-smoke", false],
  ["original-reviewed", "rm -rf ~/hol-guard-smoke", true],
  ["workspace-untrusted", "rm -r ./hol-guard-smoke", false],
  ["workspace-reviewed", "rm -r ./hol-guard-smoke", true],
  ["safe-reviewed", "printf GUARD_SAFE_COMMAND", true],
];
for (const [name, command, reviewed, mode] of cases) {
  console.log(`SUITE ${name}`);
  const child = spawn(process.execPath, [probe, resolve(guard), join(output, `${name}.json`), ...(mode ? [mode] : [])],
    { env: { ...process.env, HOL_SMOKE_COMMAND: command, HOL_SMOKE_TRUST_REVIEWED: reviewed ? "1" : "0" }, stdio: "inherit" });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  assert.equal(code, 0, `${name} failed; inspect its report before drawing a conclusion`);
}
