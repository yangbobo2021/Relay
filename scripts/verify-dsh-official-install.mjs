// Relay-owned compatibility probe for official DSH 0a53fb55bea101816fa226bb964ae2bed71c343b.
// Adapts the existing installation verifier to launch-token authentication and advertised combo URLs.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, access, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareDshLocalWorkspaceLinks } from "./lib/dsh-local-workspace-links.mjs";
import { forbiddenBackendDependencies } from "./lib/dsh-backend-dependencies.mjs";
import { chromium } from "playwright";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { verifyClientFeatures } from "./lib/dsh-client-acceptance.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const auditResults = [];
process.env.DSH_TELEMETRY_DISABLED = "1";
const dshRoot = join(root, "upstream", "deepseek-harness");
let dshBin = process.env.DSH_BIN ?? join(dshRoot, "apps", "cli", "lib", "bin.js");
let hostVersion;
const hosts = process.env.DSH_LEGACY_BIN ? [process.env.DSH_LEGACY_BIN, dshBin] : [dshBin];
const temporary = await mkdtemp(join(tmpdir(), "relay-official-dsh-"));
const codexOnly = process.argv.includes("--codex-only");
const clientFixture = "relay-dsh-client-acceptance-fixture";
const packages = [
  ["fixtures/dsh-client-acceptance", clientFixture],
  ["fixtures/dsh-event-acceptance", "relay-dsh-event-acceptance-fixture"],
  ["integrations/dsh-plugin-manager", "relay-dsh-plugin-manager"],
  ["integrations/session-import", "relay-dsh-plugin-session-import"],
  ["integrations/codex", "relay-dsh-plugin-codex"],
  ["integrations/claude", "relay-dsh-plugin-claude"],
  ["integrations/events", "relay-dsh-plugin-events"],
  ["integrations/semantic-router", "relay-dsh-plugin-semantic-router"],
  ["integrations/monitors", "relay-dsh-plugin-monitors"],
  ["integrations/dsh-workbench", "relay-dsh-plugin-workbench"],
  ["integrations/dsh-files", "relay-dsh-plugin-files"],
  ["integrations/dsh-terminal", "relay-dsh-plugin-terminal"],
].filter(([, name]) => !codexOnly || [clientFixture, "relay-dsh-plugin-codex", "relay-dsh-plugin-session-import"].includes(name));

const cleanBefore = gitStatus();
assert.equal(cleanBefore, "", "official DSH checkout must be clean before install verification");
prepareDshLocalWorkspaceLinks(dshRoot);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

try {
  const tarballs = new Map(packages.map(([directory, name]) => {
    const packed = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temporary], {
      cwd: join(root, directory), encoding: "utf8",
    }))[0];
    return [name, join(temporary, packed.filename)];
  }));

  for (const [name, file] of tarballs) console.log('ARTIFACT ' + JSON.stringify({ name,
    sha256: createHash('sha256').update(await readFile(file)).digest('hex') }));
  for (const host of hosts) {
  dshBin = host;
  hostVersion = JSON.parse(await readFile(join(dirname(dirname(host)), 'package.json'), 'utf8')).version;
  assert.ok(['0.1.1-rc.2', '0.1.2-alpha.2'].includes(hostVersion), 'select an audited official DSH runtime');

  if (codexOnly) {
    await verifyScenario("codex-only", ["relay-dsh-plugin-codex"], tarballs, 3191);
  } else {
  const eventPlugins = ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-monitors"];
  await verifyScenario("manager-only", ["relay-dsh-plugin-manager"], tarballs, 0);
  await verifyScenario("session-import-only", ["relay-dsh-plugin-session-import"], tarballs, 0);
  await verifyScenario("router-only", [eventPlugins[1]], tarballs, 3200);
  await verifyScenario("monitors-only", [eventPlugins[2]], tarballs, 3201);
  await verifyScenario("event-plugins", [...eventPlugins, "relay-dsh-event-acceptance-fixture"], tarballs, 3202);
  await verifyScenario("event-plugins-codex", [...eventPlugins, "relay-dsh-plugin-codex"], tarballs, 3203);
  await verifyScenario("event-plugins-claude", [...eventPlugins, "relay-dsh-plugin-claude"], tarballs, 3204);
  await verifyScenario("events-only", [eventPlugins[0]], tarballs, 3193);
  if (!process.argv.includes("--events-only")) {
  await verifyScenario("codex-only", ["relay-dsh-plugin-codex"], tarballs, 3191);
  await verifyScenario("claude-only", ["relay-dsh-plugin-claude"], tarballs, 3192);
  await verifyScenario("codex-and-claude", ["relay-dsh-plugin-codex", "relay-dsh-plugin-claude"], tarballs, 3194);
  await verifyScenario("workbench-only", ["relay-dsh-plugin-workbench"], tarballs, 3195);
  await verifyScenario("workbench-files", ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files"], tarballs, 3196);
  await verifyScenario("workbench-terminal", ["relay-dsh-plugin-workbench", "relay-dsh-plugin-terminal"], tarballs, 3197);
  await verifyScenario("codex-terminal", ["relay-dsh-plugin-workbench", "relay-dsh-plugin-terminal", "relay-dsh-plugin-codex"], tarballs, 3198);
  await verifyScenario("all-plugins", ["relay-dsh-plugin-manager", "relay-dsh-plugin-session-import", "relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal", "relay-dsh-plugin-codex", "relay-dsh-plugin-claude", ...eventPlugins], tarballs, 3199);
  }
  }
  }
} finally {
  await browser.close();
  if (process.env.RELAY_VERIFY_KEEP === "1") console.log(`Retained synthetic acceptance profiles: ${temporary}`);
  else await rm(temporary, { recursive: true, force: true });
}

assert.equal(gitStatus(), "", "official DSH checkout changed during install verification");
console.log(`Audit completed against ${dshBin}; inspect AUDIT_RESULT rows for failures.`);
if (auditResults.some(result => !result.ok)) process.exitCode = 1;

async function verifyScenario(id, selected, tarballs, port) {
  const filter = process.env.DSH_INSTALL_SCENARIOS?.split(",");
  if (filter && !filter.includes(id)) return;
  selected = [...selected, clientFixture];
  let result;
  try {
    await verifyScenarioImpl(id, selected, tarballs, port);
    result = { id, hostVersion, ok: true };
  } catch (error) {
    result = { id, hostVersion, ok: false, error: String(error.message).replace(/token=[^\s'"<]+/g, 'token=[REDACTED]') };
  }
  auditResults.push(result);
  console.log('AUDIT_RESULT ' + JSON.stringify(result));
}

async function verifyScenarioImpl(id, selected, tarballs, port) {
  const home = join(temporary, hostVersion, id);
  const workspace = join(home, "workspace");
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, "dual-compatibility.md"), "# Synthetic file\n\n```text\nRELAY_DUAL_FILE\n```\n");
  const env = { ...process.env, RELAY_ACCEPTANCE_WORKSPACE: workspace, DSH_HOME: home, RELAY_DATABASE_PATH: join(home, "events.sqlite"), RELAY_ROUTER_PROVIDER: "", RELAY_ROUTER_MODEL: "" };
  if (selected.includes("relay-dsh-event-acceptance-fixture")) Object.assign(env, {
    RELAY_ROUTER_PROVIDER: "relay-acceptance", RELAY_ROUTER_MODEL: "router", RELAY_ACCEPTANCE_REPORT: join(home, "acceptance.json"),
  });
  execFileSync(process.execPath, [dshBin, "plugin", "--profile", "web", "install"], {
    cwd: dshRoot, env, stdio: "inherit",
  });
  const profile = join(home, "profiles", "web");
  const overrides = ["", "overrides:", ...[...tarballs].map(([name, path]) => `  '${name}': file:${path}`), ""].join("\n");
  await appendFile(join(profile, "pnpm-workspace.yaml"), overrides);
  execFileSync(process.execPath, [dshBin, "plugin", "--profile", "web", "add", ...selected.map(name => tarballs.get(name))], {
    cwd: dshRoot, env, stdio: "inherit",
  });

  const manifest = JSON.parse(await readFile(join(profile, "package.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [...selected].sort(), `${id}: only requested plugins are direct`);
  for (const name of selected) assert.ok(manifest.dsh.profile.bundles.includes(name), `${id}: ${name} is a profile layer`);
  for (const backend of ["relay-dsh-plugin-codex", "relay-dsh-plugin-claude"]) {
    if (!selected.includes(backend)) continue;
    const installed = JSON.parse(await readFile(join(profile, "node_modules", ...backend.split("/"), "package.json"), "utf8"));
    assert.deepEqual(forbiddenBackendDependencies(installed.dependencies), [], `${id}: ${backend} is Relay-independent`);
  }

  const dump = execFileSync(process.execPath, [dshBin, "web", "--dump-config"], {
    cwd: dshRoot, env, encoding: "utf8",
  });
  for (const name of selected) assert.match(dump, new RegExp(name.replace("/", "\\/")), `${id}: ${name} composes`);
  if (!selected.includes("relay-dsh-plugin-codex")) assert.doesNotMatch(dump, /relay-codex-host/, `${id}: no Codex host`);
  if (!selected.includes("relay-dsh-plugin-claude")) assert.doesNotMatch(dump, /relay-claude-host/, `${id}: no Claude host`);
  if (!selected.includes("relay-dsh-plugin-events")) assert.doesNotMatch(dump, /relay-events-host/, `${id}: no Events host`);
  if (!selected.includes("relay-dsh-plugin-workbench")) assert.doesNotMatch(dump, /relay-workbench-host/, `${id}: no Workbench host`);
  if (!selected.includes("relay-dsh-plugin-files")) assert.doesNotMatch(dump, /relay-files-host/, `${id}: no Files host`);
  if (!selected.includes("relay-dsh-plugin-terminal")) assert.doesNotMatch(dump, /relay-terminal-host/, `${id}: no Terminal host`);
  await bootAndProbe(id, env, port, selected);
}

async function bootAndProbe(id, env, port, selected) {
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
  port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ["--expose-internals", dshBin, "web", "--no-open", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: dshRoot, env, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const authenticated = await browser.newContext({ viewport: { width: 2000, height: 1100 } });
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  try {
    await waitFor(() => output.includes(`http://127.0.0.1:${port}`) || child.exitCode !== null, 20_000);
    assert.equal(child.exitCode, null, `${id}: DSH Host exited before serving\n${output}`);
    const launchUrl = output.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)?.[0];
    if (!launchUrl && hostVersion !== '0.1.1-rc.2') throw new Error('Missing launch token in synthetic DSH startup');
    if (launchUrl) await authenticated.request.get(launchUrl);
    const cookieHeader = (await authenticated.cookies()).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const fetch = (url, options = {}) => globalThis.fetch(url, {...options, headers: {...options.headers, cookie: cookieHeader}});
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.ok, true, `${id}: Web root did not respond`);
    assert.match(await response.text(), /<html/i, `${id}: Web root is not HTML`);
    if (id === "events-only") {
      const url = `http://127.0.0.1:${port}/api/relay/events`;
      const post = () => fetch(url, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "acceptance.unmatched", source: "fixture", source_event_id: "http-once" }) });
      const first = await post();
      assert.equal(first.status, 200);
      const accepted = await first.json();
      const duplicate = await (await post()).json();
      assert.equal(duplicate.duplicate, true);
      assert.equal(duplicate.event_id, accepted.event_id);
      assert.deepEqual(duplicate.deliveries, []);
      assert.equal((await fetch(url)).status, 405);
      assert.equal((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{" })).status, 400);
      console.log("PASS HTTP: durable duplicate identity, unmatched isolation, method and JSON validation");
    }
    const page = await authenticated.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    const consoleErrors = [];
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleErrors.push(message.text()); });
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
      const graph = await page.evaluate(() => window.__DSH_BOOT__);
      for (const name of selected) {
        if (["relay-dsh-plugin-monitors", "relay-dsh-plugin-semantic-router", "relay-dsh-event-acceptance-fixture"].includes(name)) continue;
        assert.ok(graph.entries.some(entry => entry.id === name), `${id}: ${name} missing from boot graph`);
        const asset = hostVersion === '0.1.1-rc.2'
          ? graph.entries.find(entry => entry.id === name)
          : graph.batches.find(batch => batch.entries.includes(name));
        assert.ok(asset, `${id}: ${name} missing from advertised assets`);
        assert.equal((await fetch(new URL(asset.url, `http://127.0.0.1:${port}`))).ok, true, `${id}: client asset unavailable`);
      }
      assert.deepEqual(errors, [], `${id}: browser runtime errors`);
      await page.locator("button").first().waitFor({ timeout: 20_000 });
      const checks = await verifyClientFeatures(page, { selected, workspace: env.RELAY_ACCEPTANCE_WORKSPACE });
      console.log('FUNCTIONAL_RESULT ' + JSON.stringify({ id, hostVersion, checks }));
      const body = await page.locator("body").innerText();
      assert.doesNotMatch(body, /Failed to load plugins|failed to import loader entry|missed the module table/i,
        `${id}: actual browser loader failed`);
      assert.deepEqual(errors, [], `${id}: browser runtime errors`);
      if (env.RELAY_ACCEPTANCE_REPORT) {
        await waitFor(async () => { try { await access(env.RELAY_ACCEPTANCE_REPORT); return true; } catch { return false; } }, 20_000);
        const report = JSON.parse(await readFile(env.RELAY_ACCEPTANCE_REPORT, "utf8"));
        assert.equal(report.ok, true, `${id}: replay acceptance failed: ${report.error}\n${output}`);
        console.log(`PASS replay: ${JSON.stringify(report)}`);
      }
      assert.doesNotMatch(output, /failed to import|Cannot find (?:package|module)|\[E\].*(?:relay|Error)/i, `${id}: Host plugin activation error\n${output}`);
      console.log(`PASS ${id}: installed tarballs, composed, booted, browser loader`);
    } catch (error) {
      throw new Error(`${error.message}\nBrowser: ${consoleErrors.join('\n')}\nBody: ${(await page.locator('body').innerText()).slice(0, 3000)}`);
    } finally {
      await page.close();
    }
  } finally {
    await authenticated.close();
    if (child.exitCode === null) child.kill("SIGINT");
    await Promise.race([
      new Promise(resolve => child.once("exit", resolve)),
      new Promise(resolve => setTimeout(resolve, 5_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!await predicate()) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for official DSH Web boot");
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function gitStatus() {
  return execFileSync("git", ["status", "--short"], { cwd: dshRoot, encoding: "utf8" }).trim();
}
