import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixture = join(root, "dsh-lab/dsh-0.1.2-rc.1-20260903/fixtures/controlled-session-phase.mjs");
const alpha3Root = resolve(required("DSH_ALPHA3_EXACT_ROOT"));
const rc1Root = resolve(required("DSH_RC1_EXACT_ROOT"));
const reportPath = process.env.RELAY_DSH_UPGRADE_REPORT
  ? resolve(process.env.RELAY_DSH_UPGRADE_REPORT)
  : undefined;
const run = await mkdtemp(join(tmpdir(), "relay-dsh-alpha3-rc1-upgrade-"));
const persistenceRoot = join(run, "persistence");
const statePath = join(run, "state.json");

try {
  const moduleRoots = {
    alpha3: await resolveModuleRoot(alpha3Root),
    rc1: await resolveModuleRoot(rc1Root),
  };
  const versions = {
    alpha3: await packageVersion(moduleRoots.alpha3, "@deepseek-ai/dsh-session"),
    rc1: await packageVersion(moduleRoots.rc1, "@deepseek-ai/dsh-session"),
  };
  assert.equal(versions.alpha3, "0.1.2-alpha.3");
  assert.equal(versions.rc1, "0.1.2-rc.1");

  const phases = [];
  phases.push(await runPhase("create", moduleRoots.alpha3, versions.alpha3));
  phases.push(await runPhase("resume", moduleRoots.rc1, versions.rc1));
  phases.push(await runPhase("verify", moduleRoots.rc1, versions.rc1));

  assert.equal(phases[0].eventSurface, "events");
  assert.equal(phases[1].eventSurface, "snapshotEvents");
  assert.equal(phases[2].eventSurface, "snapshotEvents");
  assert.notEqual(phases[0].eventDigest, phases[1].eventDigest,
    "the continuation must add events after preserving the alpha.3 prefix");
  assert.notEqual(phases[1].eventDigest, phases[2].eventDigest,
    "a seeded rc.1 resume records its documented lifecycle boundary");
  assert.equal(phases[2].eventCount, phases[1].eventCount + 1);
  assert.deepEqual(phases[2].lifecycleEvents, ["session/end-seed"]);
  assert.equal(phases[2].turnEnds, phases[1].turnEnds);
  assert.equal(phases[1].inheritedEventCount, phases[0].inheritedEventCount);

  const report = {
    date: new Date().toISOString(),
    result: "passed",
    mode: "controlled-no-paid-model",
    source: {
      alpha3: {
        tag: "dsh-v0.1.2-alpha.3",
        commit: "dd6322d604e00eec1ba5e0c8541159906a21094a",
        runtime: "official tag archive built from the frozen pnpm lockfile",
      },
      rc1: {
        tag: "dsh-v0.1.2-rc.1",
        commit: "a66e4702047846cdaa10c66c9d3df3951f5ea70d",
        runtime: "official npm package with rc.1 dependency closure",
      },
    },
    versions,
    phases,
    assertions: {
      alpha3SeededSessionPersisted: true,
      rc1LoadedAlpha3PrefixExactly: true,
      rc1ContinuedSameSession: true,
      rc1SecondColdRestartPreservedBusinessHistory: true,
      rc1ResumeAddedOnlyDocumentedSeedBoundary: true,
      eventSequencesContiguousAndUnique: true,
      inheritedEventCountPreserved: true,
      controlledStreamChunkOrderVerified: true,
    },
    fixtureSha256: sha256(await readFile(fixture)),
  };
  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await rm(run, { recursive: true, force: true });
}

async function runPhase(phase, moduleRoot, runtimeVersion) {
  const phaseRoot = join(run, `phase-${phase}`);
  await mkdir(phaseRoot);
  await symlink(join(moduleRoot, "node_modules"), join(phaseRoot, "node_modules"), "dir");
  const phaseFile = join(phaseRoot, "controlled-session-phase.mjs");
  await copyFile(fixture, phaseFile);
  const output = execFileSync(process.execPath, [phaseFile], {
    cwd: phaseRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      RELAY_DSH_ACCEPT_PHASE: phase,
      RELAY_DSH_ACCEPT_PERSISTENCE_ROOT: persistenceRoot,
      RELAY_DSH_ACCEPT_STATE: statePath,
      RELAY_DSH_ACCEPT_RUNTIME_VERSION: runtimeVersion,
    },
  });
  return JSON.parse(output.trim().split("\n").at(-1));
}

async function packageVersion(moduleRoot, name) {
  const manifest = JSON.parse(await readFile(join(moduleRoot, "node_modules", ...name.split("/"), "package.json"), "utf8"));
  return manifest.version;
}

async function resolveModuleRoot(runtimeRoot) {
  const candidates = [runtimeRoot, join(runtimeRoot, "packages/bundle/sdk-minimal")];
  for (const candidate of candidates) {
    try {
      await readFile(join(candidate, "node_modules/@deepseek-ai/dsh-session/package.json"));
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`cannot find a DSH module closure under ${runtimeRoot}`);
}

function required(name) {
  const value = process.env[name];
  assert.ok(value, `${name} is required`);
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
