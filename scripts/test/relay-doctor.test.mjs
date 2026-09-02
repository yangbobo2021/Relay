import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { RelayStore } from "../../integrations/events/src/runtime/store.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const doctor = join(root, "scripts/relay-doctor.mjs");

test("EP10-002/003/007: doctor is read-only, versioned, layer-specific, and secret-redacted", async t => {
  const fixture = await createFixture(t);
  const seededSecret = "github_pat_SECRET-MUST-NOT-APPEAR_123456";
  const before = await stat(fixture.databasePath);
  const output = execFileSync(process.execPath, [doctor, "--json", "--database", fixture.databasePath, "--locale", "en-US", "--timezone", "Asia/Shanghai"], {
    cwd: root,
    env: {
      ...process.env,
      DSH_ROOT: fixture.dshRoot,
      DSH_HOME: fixture.dshHome,
      RELAY_GITHUB_WEBHOOK_SECRET: seededSecret,
      RELAY_GITHUB_TOKEN: seededSecret,
      RELAY_NOTIFICATION_PROVIDER: "fixture",
    },
    encoding: "utf8",
  });
  const report = JSON.parse(output);
  assert.equal(report.schema_version, 1);
  assert.equal(report.status, "healthy");
  assert.equal(report.summary.blocking_failures, 0);
  for (const id of ["packages.events", "packages.monitors", "packages.monitor_author", "packages.github", "dsh.runtime", "storage.database", "github.webhook_secret", "scheduler.availability"]) {
    assert.ok(report.checks.some(check => check.id === id), `missing doctor check ${id}`);
  }
  assert.equal(report.checks.find(check => check.id === "storage.database").details.schema_version, 10);
  assert.ok(!output.includes(seededSecret));
  const after = await stat(fixture.databasePath);
  assert.equal(after.size, before.size);
  assert.equal(after.mtimeMs, before.mtimeMs);
});

test("EP10-004/008: missing GitHub secret is an exact blocking failure in JSON and Chinese text is localized", async t => {
  const fixture = await createFixture(t);
  const failed = spawnSync(process.execPath, [doctor, "--json", "--database", fixture.databasePath], {
    cwd: root,
    env: { ...process.env, DSH_ROOT: fixture.dshRoot, DSH_HOME: fixture.dshHome, RELAY_GITHUB_WEBHOOK_SECRET: "", RELAY_LOCALE: "en-US" },
    encoding: "utf8",
  });
  assert.equal(failed.status, 1);
  const report = JSON.parse(failed.stdout);
  const check = report.checks.find(item => item.id === "github.webhook_secret");
  assert.equal(check.status, "failed");
  assert.equal(check.code, "github_secret_missing");
  assert.match(check.remediation, /RELAY_GITHUB_WEBHOOK_SECRET/u);

  const zh = execFileSync(process.execPath, [doctor, "--database", fixture.databasePath, "--locale", "zh-CN"], {
    cwd: root,
    env: { ...process.env, DSH_ROOT: fixture.dshRoot, DSH_HOME: fixture.dshHome, RELAY_GITHUB_WEBHOOK_SECRET: "0123456789abcdef" },
    encoding: "utf8",
  });
  assert.match(zh, /Relay 诊断/u);
  assert.match(zh, /已就绪/u);
});

test("EP10-004/EP15-008: doctor recognizes complete Pub/Sub OIDC and reports partial identity without exposing it", async t => {
  const fixture = await createFixture(t);
  const serviceAccount = "relay-push-sensitive@example-project.iam.gserviceaccount.com";
  const base = { ...process.env, DSH_ROOT: fixture.dshRoot, DSH_HOME: fixture.dshHome,
    RELAY_GITHUB_WEBHOOK_SECRET: "0123456789abcdef", RELAY_GMAIL_TOKEN: "gmail-api-0123456789",
    RELAY_GMAIL_PUSH_TOKEN: "", RELAY_GMAIL_PUSH_AUDIENCE: "https://relay.example.test/gmail/push" };
  let result = runDoctor(fixture, { ...base, RELAY_GMAIL_PUSH_SERVICE_ACCOUNT: serviceAccount });
  assert.equal(check(result, "email.credentials").status, "healthy");
  assert.equal(check(result, "email.credentials").details.push_authentication, "google_oidc");
  assert.ok(!result.stdout.includes(serviceAccount));

  result = runDoctor(fixture, { ...base, RELAY_GMAIL_PUSH_SERVICE_ACCOUNT: "" });
  assert.equal(check(result, "email.credentials").status, "warning");
  assert.equal(check(result, "email.credentials").code, "gmail_oidc_incomplete");
});

test("EP10-004/009: doctor distinguishes profile, migration, downgrade, corruption, DSH, and timezone failures", async t => {
  const fixture = await createFixture(t);
  const baseEnv = { ...process.env, DSH_ROOT: fixture.dshRoot, DSH_HOME: fixture.dshHome, RELAY_GITHUB_WEBHOOK_SECRET: "0123456789abcdef" };

  const database = new DatabaseSync(fixture.databasePath);
  database.exec("DELETE FROM relay_schema; INSERT INTO relay_schema(version, applied_at) VALUES (8, '2026-01-01T00:00:00Z')");
  database.close();
  let result = runDoctor(fixture, baseEnv);
  assert.equal(result.status, 1);
  assert.equal(check(result, "storage.database").code, "migration_required");

  const upgraded = new DatabaseSync(fixture.databasePath);
  upgraded.exec("DELETE FROM relay_schema; INSERT INTO relay_schema(version, applied_at) VALUES (10, '2026-01-01T00:00:00Z')");
  upgraded.close();
  result = runDoctor(fixture, baseEnv, ["--target-schema", "8"]);
  assert.equal(result.status, 1);
  assert.equal(check(result, "storage.database").code, "unsupported_downgrade");

  const tooNew = new DatabaseSync(fixture.databasePath);
  tooNew.exec("DELETE FROM relay_schema; INSERT INTO relay_schema(version, applied_at) VALUES (11, '2026-01-01T00:00:00Z')");
  tooNew.close();
  result = runDoctor(fixture, baseEnv);
  assert.equal(check(result, "storage.database").code, "schema_too_new");

  await writeFile(fixture.databasePath, "not a sqlite database");
  result = runDoctor(fixture, baseEnv);
  assert.equal(check(result, "storage.database").code, "database_corrupt");

  result = runDoctor(fixture, { ...baseEnv, DSH_ROOT: join(fixture.directory, "missing-dsh") });
  assert.equal(check(result, "dsh.runtime").code, "missing_path");

  result = runDoctor(fixture, baseEnv, ["--timezone", "Mars/Olympus"]);
  assert.equal(check(result, "runtime.timezone").code, "timezone_invalid");
});

test("EP10-004/007: profile inventory and stored credential discovery expose no secret", async t => {
  const fixture = await createFixture(t);
  const storedSecret = "stored-doctor-secret-0123456789";
  await writeFile(join(fixture.dshHome, ".credentials.yaml"), `version: 1\nrefs:\n  RELAY_GITHUB_WEBHOOK_SECRET: ${storedSecret}\n` , { mode: 0o600 });
  const env = { ...process.env, DSH_ROOT: fixture.dshRoot, DSH_HOME: fixture.dshHome,
    RELAY_GITHUB_WEBHOOK_SECRET: "", RELAY_GITHUB_TOKEN: "" };
  let result = runDoctor(fixture, env);
  assert.equal(check(result, "github.webhook_secret").status, "healthy");
  assert.equal(check(result, "github.webhook_secret").details.source, "credential-store");
  assert.ok(!result.stdout.includes(storedSecret));

  await writeFile(join(fixture.dshHome, "settings.yaml"), [
    "relay-semantic-router:",
    "  provider: 'relay-acceptance'",
    "  model: router",
    "",
  ].join("\n"), { mode: 0o600 });
  result = runDoctor(fixture, { ...env, RELAY_ROUTER_PROVIDER: "", RELAY_ROUTER_MODEL: "" });
  assert.equal(check(result, "router.configuration").status, "healthy");
  assert.equal(check(result, "router.configuration").details.source, "settings");
  assert.equal(check(result, "router.configuration").details.provider, "relay-acceptance");

  await writeFile(join(fixture.dshHome, "settings.yaml"), "relay-semantic-router:\n  provider: only-provider\n");
  result = runDoctor(fixture, { ...env, RELAY_ROUTER_PROVIDER: "", RELAY_ROUTER_MODEL: "" });
  assert.equal(check(result, "router.configuration").code, "router_configuration_incomplete");

  await writeFile(join(fixture.dshHome, "profiles", "web", "package.json"), JSON.stringify({
    dependencies: { "relay-dsh-plugin-events": "0.2.1" },
  }));
  result = runDoctor(fixture, env);
  assert.equal(result.status, 1);
  assert.deepEqual(check(result, "profile.plugins").details.missing.sort(), [
    "relay-dsh-plugin-github", "relay-dsh-plugin-monitor-author", "relay-dsh-plugin-monitors",
  ]);
});

test("EP10-005: explicit disposable probe crosses ingress-to-inbox and removes isolated storage", async t => {
  const fixture = await createFixture(t);
  const result = runDoctor(fixture, {
    ...process.env,
    DSH_ROOT: fixture.dshRoot,
    DSH_HOME: fixture.dshHome,
    RELAY_GITHUB_WEBHOOK_SECRET: "0123456789abcdef",
  }, ["--probe"]);
  assert.equal(result.status, 0);
  const probe = check(result, "probe.disposable");
  assert.equal(probe.status, "healthy");
  assert.deepEqual(probe.details, { ingress_status: 200, admitted: 1, isolated_storage: true, cleanup: "completed" });
  assert.doesNotMatch(result.stdout, /doctor-[a-f0-9-]{36}/u, "disposable record identity must not enter support output");
});

async function createFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "relay-doctor-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dshRoot = join(directory, "dsh");
  await mkdir(dshRoot);
  await writeFile(join(dshRoot, "package.json"), JSON.stringify({ name: "deepseek-harness", version: "0.1.2-alpha.3" }));
  const dshHome = join(directory, "home");
  await mkdir(join(dshHome, "profiles", "web"), { recursive: true });
  await writeFile(join(dshHome, "profiles", "web", "package.json"), JSON.stringify({ dependencies: {
    "relay-dsh-plugin-events": "0.2.1",
    "relay-dsh-plugin-monitors": "0.2.1",
    "relay-dsh-plugin-monitor-author": "0.1.0",
    "relay-dsh-plugin-github": "0.1.0",
  } }));
  const databasePath = join(directory, "events.sqlite");
  new RelayStore(databasePath).close();
  return { directory, dshRoot, dshHome, databasePath };
}

function runDoctor(fixture, env, extra = []) {
  const output = spawnSync(process.execPath, [doctor, "--json", "--database", fixture.databasePath, ...extra], {
    cwd: root, env, encoding: "utf8",
  });
  return { status: output.status, stdout: output.stdout, report: JSON.parse(output.stdout) };
}

function check(result, id) {
  const value = result.report.checks.find(item => item.id === id);
  assert.ok(value, `missing doctor check ${id}`);
  return value;
}
