import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstat, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bundleDir = dirname(fileURLToPath(import.meta.url));
const relayRoot = resolve(bundleDir, "../..");
const dshRoot = join(relayRoot, "upstream/deepseek-harness");
const probeLink = join(dshRoot, "node_modules", "relay-dsh-cold-resume-probe");

async function run(args, env) {
  const child = spawn(process.execPath, ["--import", "tsx/esm", "apps/cli/src/bin.ts", ...args], {
    cwd: dshRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", resolveExit);
  });
  assert.equal(code, 0, `DSH command failed: ${args.join(" ")}\n${stderr}`);
  return { stdout, stderr };
}

async function waitForMarker(marker, expected, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await readFile(marker, "utf8").catch(() => "");
    if (text.includes(expected)) return text;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`timed out waiting for ${expected} in ${marker}`);
}

const home = await mkdtemp(join(tmpdir(), "relay-dsh-bundle-"));
const marker = join(home, "lifecycle.log");
const env = {
  ...process.env,
  DSH_HOME: home,
  RELAY_DSH_PROBE_MARKER: marker,
};
let liveChild;
let removeProbeLink = false;

try {
  if (!(await lstat(probeLink).catch(() => null))) {
    await symlink(bundleDir, probeLink);
    removeProbeLink = true;
  }
  await run(["plugin", "--profile", "relay-probe", "add", bundleDir], env);
  const dumped = await run(["--profile", "relay-probe", "--dump-config"], env);
  assert.match(dumped.stdout, /# == relay-dsh-cold-resume-probe/);
  assert.match(dumped.stdout, /id: relay-runtime-host-probe/);

  liveChild = spawn(process.execPath, [
    "--expose-internals",
    "--import",
    "tsx/esm",
    "apps/cli/src/bin.ts",
    "--profile",
    "relay-probe",
  ], {
    cwd: dshRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  liveChild.stderr.on("data", (chunk) => { stderr += chunk; });
  await waitForMarker(marker, "loaded");
  liveChild.kill("SIGTERM");
  await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => reject(new Error(`DSH did not stop after SIGTERM\n${stderr}`)), 10_000);
    liveChild.once("exit", () => {
      clearTimeout(timer);
      resolveExit();
    });
    liveChild.once("error", reject);
  });
  const lifecycle = await waitForMarker(marker, "disposed");
  assert.deepEqual(lifecycle.trim().split("\n"), ["loaded", "disposed"]);
  process.stdout.write(`${JSON.stringify({
    bundle: "relay-dsh-cold-resume-probe",
    profile: "relay-probe",
    lifecycle: lifecycle.trim().split("\n"),
  }, null, 2)}\n`);
} finally {
  if (liveChild?.exitCode === null && liveChild.signalCode === null) {
    liveChild.kill("SIGKILL");
  }
  if (removeProbeLink) await rm(probeLink, { force: true });
  await rm(home, { recursive: true, force: true });
}
