// Relay-owned compatibility probe for official DSH 0.1.2 prereleases.
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
import { createHash, createHmac } from "node:crypto";
import { dirname } from "node:path";
import { verifyClientFeatures } from "./lib/dsh-client-acceptance.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const auditResults = [];
process.env.DSH_TELEMETRY_DISABLED = "1";
const dshRoot = resolve(process.env.DSH_ROOT ?? join(root, "upstream", "deepseek-harness"));
let dshBin = process.env.DSH_BIN ?? join(dshRoot, "apps", "cli", "lib", "bin.js");
let hostVersion;
const hosts = process.env.DSH_LEGACY_BIN ? [process.env.DSH_LEGACY_BIN, dshBin] : [dshBin];
const codexOnly = process.argv.includes("--codex-only");
const eventsOnly = process.argv.includes("--events-only");
const eventsUiOnly = process.argv.includes("--events-ui-only");
const eventBackendsOnly = process.argv.includes("--event-backends-only");
const backendControlledLive = process.argv.includes("--backend-controlled-live");
const githubCodexClosedLoop = process.argv.includes("--github-codex-closed-loop");
const githubControlledLive = process.argv.includes("--github-controlled-live");
const gmailControlledLive = process.argv.includes("--gmail-controlled-live");
const githubOnly = process.argv.includes("--github-only");
const emailOnly = process.argv.includes("--email-only");
if (gmailControlledLive) {
  for (const key of [
    "RELAY_GMAIL_TOKEN", "RELAY_GMAIL_PUSH_AUDIENCE", "RELAY_GMAIL_PUSH_SERVICE_ACCOUNT",
    "RELAY_CONTROLLED_GMAIL_ACCOUNT", "RELAY_CONTROLLED_GMAIL_THREAD_ID",
    "RELAY_CONTROLLED_GMAIL_READY_FILE", "RELAY_CONTROLLED_GMAIL_BASELINE_FILE",
    "RELAY_CONTROLLED_GMAIL_DELIVERY_FILE", "RELAY_CONTROLLED_GMAIL_REDELIVERY_FILE",
    "RELAY_CONTROLLED_WEB_PORT",
  ]) assert.ok(process.env[key]?.trim(), `--gmail-controlled-live requires protected ${key}`);
}
const temporary = await mkdtemp(join(tmpdir(), "relay-official-dsh-"));
const publishedVersion = process.env.RELAY_VERIFY_PUBLISHED_VERSION;
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
  ["integrations/monitor-time", "relay-dsh-plugin-monitor-time"],
  ["integrations/monitor-process", "relay-dsh-plugin-monitor-process"],
  ["integrations/monitor-author", "relay-dsh-plugin-monitor-author"],
  ["integrations/github", "relay-dsh-plugin-github"],
  ["integrations/email", "relay-dsh-plugin-email"],
  ["integrations/dsh-workbench", "relay-dsh-plugin-workbench"],
  ["integrations/dsh-files", "relay-dsh-plugin-files"],
  ["integrations/dsh-terminal", "relay-dsh-plugin-terminal"],
].filter(([, name]) => {
  if (codexOnly) return [clientFixture, "relay-dsh-plugin-codex", "relay-dsh-plugin-session-import"].includes(name);
  if (eventsOnly) return [clientFixture, "relay-dsh-plugin-events"].includes(name);
  if (eventsUiOnly) return [clientFixture, "relay-dsh-event-acceptance-fixture", "relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-monitor-time", "relay-dsh-plugin-monitor-author", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-github", "relay-dsh-plugin-email"].includes(name);
  if (eventBackendsOnly) return [clientFixture, "relay-dsh-plugin-session-import", "relay-dsh-plugin-codex", "relay-dsh-plugin-claude", "relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-monitor-time", "relay-dsh-plugin-semantic-router"].includes(name);
  if (backendControlledLive) return [clientFixture, "relay-dsh-event-acceptance-fixture", "relay-dsh-plugin-session-import", "relay-dsh-plugin-codex", "relay-dsh-plugin-claude", "relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-monitor-time", "relay-dsh-plugin-semantic-router"].includes(name);
  if (githubCodexClosedLoop) return [clientFixture, "relay-dsh-event-acceptance-fixture", "relay-dsh-plugin-session-import", "relay-dsh-plugin-codex", "relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-github"].includes(name);
  if (githubControlledLive) return [clientFixture, "relay-dsh-event-acceptance-fixture", "relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-github"].includes(name);
  if (gmailControlledLive) return [clientFixture, "relay-dsh-event-acceptance-fixture", "relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-email"].includes(name);
  if (githubOnly) return [clientFixture, "relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-github"].includes(name);
  if (emailOnly) return [clientFixture, "relay-dsh-plugin-events", "relay-dsh-plugin-email"].includes(name);
  return true;
});

const cleanBefore = gitStatus();
assert.equal(cleanBefore, "", "official DSH checkout must be clean before install verification");
prepareDshLocalWorkspaceLinks(dshRoot);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

try {
  const tarballs = new Map(packages.map(([directory, name]) => {
    const published = publishedVersion && name.startsWith("relay-dsh-plugin-");
    const source = published ? `${name}@${publishedVersion}` : undefined;
    if (!published) {
      try {
        execFileSync("npm", ["run", "build", "--if-present"], {
          cwd: join(root, directory), env: { ...process.env, DSH_ROOT: dshRoot }, stdio: "pipe",
        });
      } catch (error) {
        throw new Error(`${name}: package build failed\n${String(error.stderr ?? "").slice(-4000)}`, { cause: error });
      }
    }
    const packed = JSON.parse(execFileSync("npm", ["pack", ...(source ? [source] : []), "--ignore-scripts", "--json", "--pack-destination", temporary], {
      cwd: published ? root : join(root, directory), encoding: "utf8",
    }))[0];
    return [name, join(temporary, packed.filename)];
  }));

  for (const [name, file] of tarballs) console.log('ARTIFACT ' + JSON.stringify({ name,
    sha256: createHash('sha256').update(await readFile(file)).digest('hex') }));
  for (const host of hosts) {
  dshBin = host;
  hostVersion = JSON.parse(await readFile(join(dirname(dirname(host)), 'package.json'), 'utf8')).version;
  assert.ok(['0.1.1-rc.2', '0.1.2-alpha.2', '0.1.2-alpha.3'].includes(hostVersion), 'select an audited official DSH runtime');

  if (codexOnly) {
    await verifyScenario("codex-only", ["relay-dsh-plugin-codex"], tarballs, 3191);
  } else if (eventsOnly) {
    await verifyScenario("events-only", ["relay-dsh-plugin-events"], tarballs, 3193);
  } else if (eventsUiOnly) {
    await verifyScenario("event-management-ui", ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-monitors", "relay-dsh-plugin-monitor-time", "relay-dsh-plugin-monitor-author", "relay-dsh-plugin-github", "relay-dsh-plugin-email", "relay-dsh-event-acceptance-fixture"], tarballs, 3207);
  } else if (eventBackendsOnly) {
    const eventPlugins = ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-monitors"];
    await verifyScenario("event-plugins-codex", [...eventPlugins, "relay-dsh-plugin-codex"], tarballs, 3203);
    await verifyScenario("event-plugins-claude", [...eventPlugins, "relay-dsh-plugin-claude"], tarballs, 3204);
  } else if (backendControlledLive) {
    const eventPlugins = ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-monitors"];
    await verifyScenario("event-codex-controlled-live", [...eventPlugins, "relay-dsh-plugin-codex", "relay-dsh-event-acceptance-fixture"], tarballs, 3210);
    await verifyScenario("event-claude-controlled-live", [...eventPlugins, "relay-dsh-plugin-claude", "relay-dsh-event-acceptance-fixture"], tarballs, 3211);
  } else if (githubCodexClosedLoop) {
    await verifyScenario("github-codex-closed-loop", ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router",
      "relay-dsh-plugin-monitors", "relay-dsh-plugin-github", "relay-dsh-plugin-codex",
      "relay-dsh-event-acceptance-fixture"], tarballs, 3212);
  } else if (githubControlledLive) {
    await verifyScenario("github-controlled-live", ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router",
      "relay-dsh-plugin-monitors", "relay-dsh-plugin-github", "relay-dsh-event-acceptance-fixture"], tarballs, 3208);
  } else if (gmailControlledLive) {
    await verifyScenario("gmail-controlled-live", ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router",
      "relay-dsh-plugin-monitors", "relay-dsh-plugin-email", "relay-dsh-event-acceptance-fixture"], tarballs, 3213);
  } else if (githubOnly) {
    await verifyScenario("github-event-loop", ["relay-dsh-plugin-events", "relay-dsh-plugin-monitors", "relay-dsh-plugin-github"], tarballs, 3205);
  } else if (emailOnly) {
    await verifyScenario("email-event-loop", ["relay-dsh-plugin-events", "relay-dsh-plugin-email"], tarballs, 3206);
  } else {
  const eventPlugins = ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-monitors"];
  await verifyScenario("manager-only", ["relay-dsh-plugin-manager"], tarballs, 0);
  await verifyScenario("session-import-only", ["relay-dsh-plugin-session-import"], tarballs, 0);
  await verifyScenario("router-only", [eventPlugins[1]], tarballs, 3200);
  await verifyScenario("monitors-only", [eventPlugins[2]], tarballs, 3201);
  await verifyScenario("event-plugins", [...eventPlugins, "relay-dsh-event-acceptance-fixture"], tarballs, 3202);
  await verifyScenario("monitor-author", [...eventPlugins, "relay-dsh-plugin-monitor-time", "relay-dsh-plugin-monitor-author", "relay-dsh-event-acceptance-fixture"], tarballs, 3214);
  await verifyScenario("event-plugins-codex", [...eventPlugins, "relay-dsh-plugin-codex"], tarballs, 3203);
  await verifyScenario("event-plugins-claude", [...eventPlugins, "relay-dsh-plugin-claude"], tarballs, 3204);
  await verifyScenario("events-only", [eventPlugins[0]], tarballs, 3193);
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
  const env = { ...process.env, RELAY_ACCEPTANCE_WORKSPACE: workspace, DSH_HOME: home, RELAY_DATABASE_PATH: join(home, "events.sqlite"), RELAY_EMAIL_DATABASE_PATH: join(home, "email.sqlite"), RELAY_ROUTER_PROVIDER: "", RELAY_ROUTER_MODEL: "" };
  if (id === "event-management-ui") Object.assign(env, {
    RELAY_GITHUB_TOKEN: "",
    RELAY_GITHUB_WEBHOOK_SECRET: "",
    RELAY_GITHUB_WEBHOOK_SECRET_PREVIOUS: "",
  });
  if (id === "event-codex-controlled-live") Object.assign(env, {
    RELAY_CONTROLLED_BACKEND: "codex", RELAY_CODEX_LINK_PATH: join(home, "codex-links.json"),
  });
  if (id === "event-claude-controlled-live") Object.assign(env, {
    RELAY_CONTROLLED_BACKEND: "claude", RELAY_CLAUDE_LINK_PATH: join(home, "claude-links.json"),
  });
  if (id === "github-codex-closed-loop") Object.assign(env, {
    RELAY_CONTROLLED_GITHUB_CODEX_LOOP: "1", RELAY_CODEX_LINK_PATH: join(home, "codex-links.json"),
  });
  if (id === "github-event-loop") env.RELAY_GITHUB_WEBHOOK_SECRET = "relay-acceptance-github-webhook-secret";
  if (id === "email-event-loop") env.RELAY_GMAIL_PUSH_TOKEN = "relay-acceptance-gmail-push-token";
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
  const controlledPort = Number(process.env.RELAY_CONTROLLED_WEB_PORT);
  if (["github-controlled-live", "gmail-controlled-live"].includes(id)
    && Number.isSafeInteger(controlledPort) && controlledPort > 0 && controlledPort <= 65535) {
    port = controlledPort;
  } else {
    const reservation = createServer();
    await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
    port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
  }
  const child = spawn(process.execPath, ["--expose-internals", dshBin, "web", "--no-open", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: dshRoot, env, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const authenticated = await browser.newContext({ viewport: id === "event-management-ui" ? { width: 1280, height: 720 } : { width: 2000, height: 1100 } });
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
    const probeEventsHttp = id === "events-only" ? async () => {
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
    } : null;
    if (id === "github-event-loop") {
      const url = `http://127.0.0.1:${port}/api/relay/github/webhook`;
      const payload = Buffer.from(JSON.stringify({ zen: "acceptance" }));
      const signature = createHmac("sha256", env.RELAY_GITHUB_WEBHOOK_SECRET).update(payload).digest("hex");
      const headers = {
        "content-type": "application/json",
        "x-github-event": "ping",
        "x-github-delivery": "official-dsh-github-once",
        "x-hub-signature-256": `sha256=${signature}`,
      };
      const first = await fetch(url, { method: "POST", headers, body: payload });
      assert.equal(first.status, 202);
      const accepted = await first.json();
      assert.equal(accepted.accepted, true);
      assert.equal(accepted.disposition, "dismiss");
      const duplicate = await (await fetch(url, { method: "POST", headers, body: payload })).json();
      assert.equal(duplicate.duplicate, true);
      assert.equal(duplicate.event_id, accepted.event_id);
      const invalid = await fetch(url, { method: "POST", headers: { ...headers, "x-hub-signature-256": `sha256=${"0".repeat(64)}` }, body: payload });
      assert.equal(invalid.status, 401);
      console.log("PASS GitHub HTTP: raw-body HMAC, durable dismissal, duplicate identity, invalid signature");
    }
    if (id === "email-event-loop") {
      const url = `http://127.0.0.1:${port}/api/relay/email/gmail/push`;
      const data = Buffer.from(JSON.stringify({ emailAddress: "acceptance@example.test", historyId: "100" })).toString("base64");
      const body = JSON.stringify({ message: { messageId: "official-dsh-email-once", data } });
      const denied = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer wrong" }, body });
      assert.equal(denied.status, 401);
      const accepted = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${env.RELAY_GMAIL_PUSH_TOKEN}` }, body });
      assert.equal(accepted.status, 202);
      const payload = await accepted.json();
      assert.equal(payload.initialized, true);
      assert.equal(payload.cursor, "100");
      assert.equal(payload.event_count, 0);
      console.log("PASS Email HTTP: authentication, durable initial cursor, no mailbox replay");
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
        if (["relay-dsh-plugin-monitors", "relay-dsh-plugin-monitor-time", "relay-dsh-plugin-monitor-process", "relay-dsh-plugin-monitor-author",
          "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-github", "relay-dsh-plugin-email",
          "relay-dsh-event-acceptance-fixture"].includes(name)) continue;
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
      if (id === "events-only") {
        await verifyEmptyEventsUi(page);
        await probeEventsHttp();
        await page.waitForFunction(() => document.querySelector("[data-relay-event-total]")?.getAttribute("data-relay-event-total") === "1");
        console.log("UI_STAGE empty Events state transitioned to one durable HTTP Event");
      }
      const body = await page.locator("body").innerText();
      assert.doesNotMatch(body, /Failed to load plugins|failed to import loader entry|missed the module table/i,
        `${id}: actual browser loader failed`);
      assert.deepEqual(errors, [], `${id}: browser runtime errors`);
      if (env.RELAY_ACCEPTANCE_REPORT) {
        const reportTimeoutMs = id === "github-controlled-live" || id.endsWith("controlled-live")
          || id === "github-codex-closed-loop" ? 360_000 : 20_000;
        await waitFor(async () => { try { await access(env.RELAY_ACCEPTANCE_REPORT); return true; } catch { return false; } }, reportTimeoutMs);
        const report = JSON.parse(await readFile(env.RELAY_ACCEPTANCE_REPORT, "utf8"));
        assert.equal(report.ok, true, `${id}: replay acceptance failed: ${report.error}\n${output}`);
        console.log(`PASS replay: ${JSON.stringify(report)}`);
      }
      if (id === "event-management-ui") {
        const uiChecks = await verifyEventsManagementUi(page, env, consoleErrors, errors);
        checks.push(...uiChecks);
        console.log("UI_RESULT " + JSON.stringify({ id, checks: uiChecks }));
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

async function verifyEmptyEventsUi(page) {
  const dismissProviderOnboarding = async ({ wait = false } = {}) => {
    const configureLater = page.getByRole("button", { name: "Configure later", exact: true });
    if (wait) await configureLater.waitFor({ state: "visible" });
    if (!await configureLater.isVisible()) return;
    await configureLater.click();
    await configureLater.waitFor({ state: "hidden" });
  };
  await dismissProviderOnboarding({ wait: true });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await dismissProviderOnboarding();
  await page.getByText("Waiting events", { exact: true }).click();
  await page.getByText("No tasks are waiting", { exact: true }).waitFor();
  await page.getByText("No event history", { exact: true }).waitFor();
  assert.equal(await page.locator("[data-relay-event-total]").getAttribute("data-relay-event-total"), "0");
  const refresh = page.getByRole("button", { name: "Refresh", exact: true });
  assert.equal(await refresh.isEnabled(), true);
}

async function verifyEventsManagementUi(page, env, consoleErrors, errors) {
  const artifactDir = resolve(process.env.RELAY_VERIFY_ARTIFACT_DIR ?? join(dirname(env.RELAY_ACCEPTANCE_REPORT), "ui-artifacts"));
  await mkdir(artifactDir, { recursive: true });
  const setLocale = async locale => {
    await page.evaluate(async locale => { await window.__RELAY_DSH_TEST__.get("locale").setLocale(locale); }, locale);
    await page.waitForFunction(locale => document.documentElement.lang.startsWith(locale), locale);
  };
  const openManagement = async label => {
    const settings = page.getByRole("button", { name: label === "Waiting events" ? "Settings" : "设置", exact: true });
    if (!await settings.isVisible()) await page.keyboard.press("Escape");
    await settings.click();
    await page.getByText(label, { exact: true }).click();
  };

  await setLocale("en");
  await openManagement("Waiting events");
  const origin = new URL(page.url()).origin;
  await page.getByRole("heading", { name: "Supported Monitor Bundles", exact: true }).waitFor();
  assert.match(await page.locator("[data-relay-bundle-catalog]").innerText(), /24 types/u);
  const bundleCatalog = page.locator("[data-relay-bundle-catalog]");
  const firstBundleIds = await bundleCatalog.locator("[data-relay-bundle-type]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-relay-bundle-type")));
  assert.equal(firstBundleIds.length, 20, "first Bundle catalog page must contain its configured page size");
  const bundlePagination = page.getByRole("navigation", { name: "Monitor Bundle catalog pagination", exact: true });
  await bundlePagination.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("section[aria-live='polite']")?.getAttribute("aria-busy") === "true");
  await page.waitForFunction(() => document.querySelector("section[aria-live='polite']")?.getAttribute("aria-busy") === "false");
  await bundlePagination.getByText("Page 2", { exact: true }).waitFor();
  const timeBundle = bundleCatalog.locator('[data-relay-bundle-type="time.deadline"]');
  await timeBundle.getByText("Deadline timer", { exact: true }).waitFor();
  const secondBundleIds = await bundleCatalog.locator("[data-relay-bundle-type]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-relay-bundle-type")));
  assert.equal(new Set([...firstBundleIds, ...secondBundleIds]).size, 24, "Bundle catalog pagination must not duplicate or omit types");
  assert.equal(await timeBundle.getAttribute("data-relay-bundle-status"), "available");
  assert.match(await timeBundle.innerText(), /time\.deadline@1/u);
  assert.match(await timeBundle.innerText(), /relay-monitor-time/u);
  assert.match(await timeBundle.innerText(), /timer\.elapsed/u);
  assert.match(await timeBundle.innerText(), /clock\.read/u);
  assert.match(await timeBundle.innerText(), /Reads Relay's host clock/u);
  const githubBundle = bundleCatalog.locator('[data-relay-bundle-type="github.pull-request"]');
  await githubBundle.getByText("GitHub pull request", { exact: true }).waitFor();
  assert.equal(await githubBundle.getAttribute("data-relay-bundle-status"), "configuration_required");
  assert.match(await githubBundle.innerText(), /github\.pull_request\.transition/u);
  assert.match(await githubBundle.innerText(), /github\.pull-request\.read/u);
  assert.match(await githubBundle.innerText(), /Configure a project-scoped GitHub token/u);
  console.log("UI_STAGE packed live Bundle catalog, status, metadata, and keyset pagination passed");
  await page.getByText("Synthetic pending timer for management QA", { exact: true }).waitFor();
  const monitorRow = page.locator("li").filter({ hasText: "Synthetic pending timer for management QA" }).first();
  await monitorRow.getByText("Monitor target: octo/relay#42", { exact: true }).waitFor();
  assert.match(await monitorRow.innerText(), /Revision: 01234567…234567/u);
  assert.match(await monitorRow.innerText(), /PR state: open/u);
  assert.match(await monitorRow.innerText(), /Review: approved/u);
  assert.match(await monitorRow.innerText(), /1\/2 checks passed/u);
  assert.match(await monitorRow.innerText(), /Last error: rate_limited/u);
  await page.getByText("Event history", { exact: true }).waitFor();
  await page.getByText("Next action:", { exact: false }).first().waitFor();
  assert.equal(await page.locator("script").filter({ hasText: "__RELAY_XSS__" }).count(), 0, "hostile continuation must remain text");
  assert.equal(await page.evaluate(() => Boolean(window.__RELAY_XSS__)), false, "hostile continuation executed");
  const english = await page.locator("body").innerText();
  assert.match(english, /Active|Completed/u);
  assert.doesNotMatch(english, /等待中|事件历史|立即检查/u);
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.clientHeight,
    section: (() => { const node = [...document.querySelectorAll("section")].find(element => element.textContent?.includes("Event history")); if (!node) return null; const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })(),
  }));
  assert.ok(geometry.scrollWidth <= geometry.width, `management UI overflows horizontally: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.section && geometry.section.left >= 0 && geometry.section.right <= geometry.width, `management section is clipped: ${JSON.stringify(geometry)}`);
  await assertRelayTextContrast(page);
  await page.screenshot({ path: join(artifactDir, "events-management-en-1280x720.png") });

  await page.evaluate(() => { window.__RELAY_DSH_TEST__.get("theme").setTheme("dark"); });
  await page.waitForFunction(() => document.body.hasAttribute("data-ds-dark-theme"));
  await assertRelayTextContrast(page);
  await page.screenshot({ path: join(artifactDir, "events-management-en-dark-1280x720.png") });
  await page.evaluate(() => { window.__RELAY_DSH_TEST__.get("theme").setTheme("light"); });
  await page.waitForFunction(() => !document.body.hasAttribute("data-ds-dark-theme"));

  const router = page.locator("article").filter({ hasText: "Semantic Router" });
  await router.getByText("Events without trusted ownership", { exact: false }).waitFor();
  await router.getByRole("button", { name: "Disable", exact: true }).click();
  const disableRouter = router.getByRole("alertdialog", { name: "Disable semantic routing and return to exact routing only?", exact: true });
  await disableRouter.waitFor();
  await disableRouter.getByRole("button", { name: "Confirm disable", exact: true }).click();
  await router.getByText("Relay remains healthy and uses exact routing only.", { exact: false }).waitFor();

  const retryNotification = page.getByRole("button", { name: "Retry notification", exact: true }).first();
  await retryNotification.waitFor();
  const notificationEvent = page.locator("ol li").filter({ has: retryNotification }).first();
  await retryNotification.click();
  await notificationEvent.getByText("2 attempts", { exact: false }).waitFor();
  assert.match(await notificationEvent.innerText(), /Unavailable/u, "retry without a provider must remain visibly unavailable");
  console.log("UI_STAGE notification retry remained explicit and inspectable");

  for (let index = 0; index < 25; index += 1) {
    const response = await page.request.post(`${origin}/api/relay/events`, {
      data: {
        source: "ui-pagination",
        source_event_id: `ui-page-${index}`,
        fingerprint: `ui-page-${index}`,
        type: `ui.page.${String(index).padStart(2, "0")}`,
      },
    });
    assert.equal(response.status(), 200, `pagination seed ${index} must be accepted`);
  }
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector("[data-relay-event-total]")?.getAttribute("data-relay-event-total")) >= 28);
  const sourceFilter = page.getByLabel("Source", { exact: true });
  await sourceFilter.fill("ui-pagination");
  const firstPageIds = await page.locator("ol").last().locator("strong").allTextContents();
  assert.equal(firstPageIds.length, 20, "first Event page must contain the configured page size");
  const eventPagination = page.getByRole("navigation", { name: "Event history pagination", exact: true });
  await eventPagination.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("section[aria-live='polite']")?.getAttribute("aria-busy") === "true");
  await page.waitForFunction(() => document.querySelector("section[aria-live='polite']")?.getAttribute("aria-busy") === "false");
  await eventPagination.getByText("Page 2", { exact: true }).waitFor();
  assert.equal(await sourceFilter.inputValue(), "ui-pagination", "filters must survive page refresh");
  const secondPageIds = await page.locator("ol").last().locator("strong").allTextContents();
  assert.ok(secondPageIds.length >= 5);
  assert.equal(new Set([...firstPageIds, ...secondPageIds]).size, firstPageIds.length + secondPageIds.length,
    "pagination must not duplicate Event rows");
  await eventPagination.getByRole("button", { name: "Previous", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("section[aria-live='polite']")?.getAttribute("aria-busy") === "true");
  await page.waitForFunction(() => document.querySelector("section[aria-live='polite']")?.getAttribute("aria-busy") === "false");
  await eventPagination.getByText("Page 1", { exact: true }).waitFor();
  assert.equal(await sourceFilter.inputValue(), "ui-pagination");

  const routerProvider = router.getByLabel("Model provider", { exact: true });
  const routerModel = router.getByLabel("Model", { exact: true });
  const totalBeforeBackground = Number(await page.locator("[data-relay-event-total]").getAttribute("data-relay-event-total"));
  const locationBeforeBackground = page.url();
  await routerProvider.fill("draft-must-survive-background-refresh");
  await routerProvider.focus();
  const background = await page.request.post(`${origin}/api/relay/events`, {
    data: {
      source: "ui-background",
      source_event_id: "ui-background-1",
      fingerprint: "ui-background-1",
      type: "ui.background.completed",
    },
  });
  assert.equal(background.status(), 200);
  await page.waitForFunction(total => Number(document.querySelector("[data-relay-event-total]")?.getAttribute("data-relay-event-total")) > total,
    totalBeforeBackground);
  assert.equal(page.url(), locationBeforeBackground, "background completion must not navigate");
  assert.equal(await routerProvider.inputValue(), "draft-must-survive-background-refresh", "background refresh must preserve form input");
  assert.equal(await routerProvider.evaluate(node => document.activeElement === node), true, "background refresh must preserve focus");
  console.log("UI_STAGE background completion preserved navigation, focus, and form state");

  // Keep the Router disabled until after the refresh assertion. The acceptance
  // Router intentionally selects a candidate for unbound Events, which would
  // consume the pending Monitor and make the later lifecycle test non-deterministic.
  await routerProvider.fill("relay-acceptance");
  await routerModel.fill("router");
  await router.getByRole("button", { name: "Configure", exact: true }).click();
  await router.getByText("Events without trusted ownership", { exact: false }).waitFor();
  assert.equal(await routerProvider.inputValue(), "");
  assert.equal(await routerModel.inputValue(), "");
  console.log("UI_STAGE Semantic Router disable/configure and stable pagination passed");

  await page.setViewportSize({ width: 1440, height: 900 });
  const wideGeometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(wideGeometry.scrollWidth <= wideGeometry.width, `1440x900 management UI overflows: ${JSON.stringify(wideGeometry)}`);
  await page.screenshot({ path: join(artifactDir, "events-management-en-1440x900.png") });
  await page.setViewportSize({ width: 1280, height: 720 });

  const github = page.locator("article").filter({ hasText: "GitHub" });
  const githubOld = "ui-github-secret-0123456789-old";
  const githubNew = "ui-github-secret-0123456789-new";
  const githubSecretInput = github.getByLabel("Webhook secret", { exact: true });
  await githubSecretInput.fill(githubOld);
  await github.getByRole("button", { name: "Configure", exact: true }).click();
  await waitFor(async () => await github.getByLabel("New webhook secret", { exact: true }).inputValue() === "", 10_000);
  await github.getByText("Configured", { exact: true }).first().waitFor();
  assert.doesNotMatch(await page.locator("body").innerText(), new RegExp(`${githubOld}|${githubNew}`, "u"), "GitHub secrets must never be rendered");
  assert.equal(await sendGitHubPing(page, origin, githubOld, "ui-github-old"), 202);
  const githubRotationInput = github.getByLabel("New webhook secret", { exact: true });
  await githubRotationInput.fill(githubNew);
  await github.getByRole("button", { name: "Rotate", exact: true }).click();
  await waitFor(async () => await githubRotationInput.inputValue() === "", 10_000);
  assert.equal(await sendGitHubPing(page, origin, githubOld, "ui-github-overlap-old"), 202, "old secret must remain valid during rotation overlap");
  assert.equal(await sendGitHubPing(page, origin, githubNew, "ui-github-overlap-new"), 202, "new secret must be active without restart");
  console.log("UI_STAGE GitHub credential lifecycle passed");

  const email = page.locator("article").filter({ has: page.locator('[id="gmail-api-relay.gmail"]') });
  const gmailApi = "ui-gmail-api-0123456789-secret";
  const gmailPush = "ui-gmail-push-0123456789-secret";
  const gmailApiInput = email.getByLabel("Gmail API token", { exact: true });
  const gmailPushInput = email.getByLabel("Gmail push token", { exact: true });
  await gmailApiInput.fill(gmailApi);
  await gmailPushInput.fill(gmailPush);
  await email.getByRole("button", { name: "Configure", exact: true }).click();
  await waitFor(async () => await gmailApiInput.inputValue() === "" && await gmailPushInput.inputValue() === "", 10_000);
  await email.getByText("Push authentication configured", { exact: false }).waitFor();
  assert.doesNotMatch(await page.locator("body").innerText(), new RegExp(`${gmailApi}|${gmailPush}`, "u"), "Gmail credentials must never be rendered");
  assert.equal(await sendGmailPush(page, origin, gmailPush, "acceptance@example.test", "100"), 202);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await email.getByText("acceptance@example.test", { exact: true }).waitFor();
  await email.getByRole("button", { name: "Pause", exact: true }).click();
  await email.getByRole("button", { name: "Resume", exact: true }).waitFor();
  await email.getByRole("button", { name: "Resume", exact: true }).click();
  await email.getByRole("button", { name: "Pause", exact: true }).waitFor();
  console.log("UI_STAGE Gmail credential and mailbox lifecycle passed");

  const operationFaults = [
    ["stale@example.test", "The state changed in another operation. Refresh and try again."],
    ["busy@example.test", "The target is being checked. Wait for it to finish and try again."],
    ["provider@example.test", "The required provider is unavailable. Check the plugin or connection configuration."],
    ["server@example.test", "The operation failed. Try again."],
  ];
  for (const [account, expected] of operationFaults) {
    const faultConnector = page.locator("article").filter({ hasText: account });
    await faultConnector.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("alert").getByText(expected, { exact: true }).waitFor();
  }
  const beforeMissingSession = page.url();
  const missingSession = page.locator("li").filter({ hasText: "Synthetic missing conversation" }).first();
  await missingSession.getByRole("button", { name: "Synthetic missing conversation", exact: true }).click();
  await page.getByRole("alert").getByText("The owning conversation was deleted or is unavailable. Navigation was not changed.", { exact: true }).waitFor();
  assert.equal(page.url(), beforeMissingSession, "opening a missing Session must not navigate");

  const loadFault = page.locator("article").filter({ hasText: "load-error@example.test" });
  await loadFault.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("alert").getByText("Waiting events could not be loaded.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("Synthetic pending timer for management QA", { exact: true }).waitFor();
  console.log("UI_STAGE stale, busy, provider, server, missing-Session, and retryable load failures passed");

  const cadence = monitorRow.getByLabel("Check interval (seconds)", { exact: true });
  await cadence.fill("0");
  await monitorRow.getByRole("button", { name: "Update", exact: true }).click();
  await page.getByRole("alert").getByText("The check interval must be a whole number from 1 to 86400 seconds.", { exact: true }).waitFor();
  await cadence.fill("7200");
  await monitorRow.getByRole("button", { name: "Update", exact: true }).click();
  await monitorRow.getByText("Cadence: 7200 seconds", { exact: false }).waitFor();
  assert.equal(await cadence.inputValue(), "7200");
  assert.match(await monitorRow.innerText(), /Cadence: 7200 seconds/u);
  console.log("UI_STAGE Monitor cadence validation and durable update passed");

  const pause = page.locator('[data-relay-monitor-action="pause"]');
  await focusByTabSelector(page, '[data-relay-monitor-action="pause"]');
  assert.equal(await pause.evaluate(node => node.matches(":focus-visible")), true, "pause control must expose visible keyboard focus");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Resume", exact: true }).waitFor();
  const resume = page.locator('[data-relay-monitor-action="resume"]');
  await focusByTabSelector(page, '[data-relay-monitor-action="resume"]');
  await page.keyboard.press("Enter");
  const resumedPause = page.locator('[data-relay-monitor-action="pause"]');
  await resumedPause.waitFor();

  const stop = page.locator('[data-relay-monitor-action="stop"]');
  await focusByTabSelector(page, '[data-relay-monitor-action="pause"]');
  await page.keyboard.press("Tab");
  assert.equal(await stop.evaluate(node => document.activeElement === node), true, "stop must follow monitor pause in keyboard order");
  await page.keyboard.press("Enter");
  const confirmation = page.getByRole("alertdialog", { name: /Stop monitor/u });
  await confirmation.waitFor();
  assert.match(await confirmation.innerText(), /Stop monitor/u);
  await page.screenshot({ path: join(artifactDir, "events-management-stop-confirm-en-1280x720.png") });
  const keepStop = confirmation.getByRole("button", { name: "Keep", exact: true });
  const confirmStop = confirmation.getByRole("button", { name: "Confirm stop", exact: true });
  assert.equal(await keepStop.evaluate(node => document.activeElement === node), true, "dialog must receive focus");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await confirmStop.evaluate(node => document.activeElement === node), true, "dialog focus must wrap backward");
  await page.keyboard.press("Tab");
  assert.equal(await keepStop.evaluate(node => document.activeElement === node), true, "dialog focus must wrap forward");
  await page.keyboard.press("Escape");
  await stop.waitFor();
  await page.waitForFunction(() => document.activeElement === document.querySelector('[data-relay-monitor-action="stop"]'));
  assert.equal(await stop.evaluate(node => document.activeElement === node), true, "Escape must return focus to the destructive trigger");

  await setLocale("zh");
  await page.getByRole("heading", { name: "支持的 Monitor Bundle", exact: true }).waitFor();
  await timeBundle.getByText("截止时间计时器", { exact: true }).waitFor();
  await githubBundle.getByText("GitHub 拉取请求", { exact: true }).waitFor();
  assert.match(await timeBundle.innerText(), /仅读取 Relay 主机时钟/u);
  assert.match(await githubBundle.innerText(), /请配置项目范围的 GitHub Token/u);
  await page.getByText("事件历史", { exact: true }).waitFor();
  const providerFaultZh = page.locator("article").filter({ hasText: "provider@example.test" });
  await providerFaultZh.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("alert").getByText("所需提供方当前不可用，请检查插件或连接配置。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "暂停", exact: true }).first().waitFor();
  const chinese = await page.locator("body").innerText();
  assert.match(chinese, /等待中|事件历史|下一步/u);
  assert.doesNotMatch(chinese, /Waiting events|Event history|Next action/u);
  const cadenceZh = page.getByLabel("检查间隔（秒）", { exact: true });
  await cadenceZh.fill("86401");
  await cadenceZh.locator("xpath=..").getByRole("button", { name: "更新", exact: true }).click();
  await page.getByRole("alert").getByText("检查间隔必须是 1 到 86400 之间的整数秒。", { exact: true }).waitFor();
  await cadenceZh.fill("7200");
  await assertRelayTextContrast(page);
  assert.match(await monitorRow.innerText(), /监控目标: octo\/relay#42/u);
  assert.match(await monitorRow.innerText(), /检查 1\/2 通过/u);
  await monitorRow.getByRole("button", { name: "停止", exact: true }).click();
  const stopZh = monitorRow.getByRole("alertdialog", { name: /停止监控/u });
  await stopZh.getByRole("button", { name: "确认停止", exact: true }).click();
  await monitorRow.getByText("终止原因: 由用户停止", { exact: false }).waitFor();
  await page.screenshot({ path: join(artifactDir, "events-management-zh-1280x720.png") });
  const history = page.getByRole("heading", { name: "事件历史", exact: true });
  await history.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(artifactDir, "events-management-history-zh-1280x720.png") });

  const githubZh = page.locator("article").filter({ hasText: "GitHub" });
  await githubZh.getByRole("button", { name: "撤销", exact: true }).click();
  const revoke = githubZh.getByRole("alertdialog", { name: "撤销后，所有 GitHub Webhook 将立即被拒绝。", exact: true });
  await revoke.waitFor();
  await page.screenshot({ path: join(artifactDir, "events-management-revoke-confirm-zh-1280x720.png") });
  await revoke.getByRole("button", { name: "确认撤销", exact: true }).click();
  await waitFor(async () => await githubZh.getByLabel("Webhook 密钥", { exact: true }).count() === 1, 10_000);
  assert.equal(await sendGitHubPing(page, origin, githubNew, "ui-github-revoked"), 503, "revoked GitHub secrets must fail immediately");

  const emailZh = page.locator("article").filter({ has: page.locator('[id="gmail-api-relay.gmail"]') });
  await emailZh.getByRole("button", { name: "断开", exact: true }).click();
  const disconnect = emailZh.getByRole("alertdialog", { name: /断开邮箱 acceptance@example\.test/u });
  await disconnect.waitFor();
  await disconnect.getByRole("button", { name: "确认断开", exact: true }).click();
  await emailZh.getByText("尚无已同步邮箱", { exact: true }).waitFor();

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.lang.startsWith("zh"));
  await openManagement("等待事件");
  await page.getByText("事件历史", { exact: true }).waitFor();
  const unnamedControls = await page.locator("[data-relay-management-root] button, [data-relay-management-root] input, [data-relay-management-root] select").evaluateAll(nodes => nodes
    .filter(node => {
      const element = node;
      const labels = "labels" in element ? [...(element.labels ?? [])].map(label => label.textContent ?? "").join(" ") : "";
      return !(element.getAttribute("aria-label") || labels.trim() || element.textContent?.trim() || element.getAttribute("title"));
    })
    .map(node => ({
      tag: node.tagName,
      type: node.getAttribute("type"),
      id: node.id,
      class: node.getAttribute("class"),
      placeholder: node.getAttribute("placeholder"),
      html: node.outerHTML.slice(0, 500),
      relaySection: node.closest("section")?.getAttribute("aria-labelledby") ?? null,
    })));
  assert.deepEqual(unnamedControls, [], "every management control must have an accessible name");
  assert.equal(await page.getByRole("heading", { name: "事件历史", exact: true }).count(), 1);
  assert.deepEqual(errors, [], "management UI emitted page/resource errors");
  assert.deepEqual(consoleErrors, [], "management UI emitted console warnings/errors");
  return ["English/Chinese management UI", "live packed Monitor Bundle catalog and status", "Bundle catalog keyset pagination", "light/dark WCAG AA computed text contrast", "1280x720 and 1440x900 geometry", "keyboard pause/resume/stop confirmation", "Monitor cadence validation/update", "PR Monitor target/SHA/review/check/rate-limit details", "durable localized Monitor terminal reason", "hostile text escaping", "locale reload persistence", "browser console/network cleanliness", "Semantic Router disable/configure", "stable Event keyset pagination and filters", "GitHub configure/rotate/overlap/revoke", "Gmail configure/push/pause/resume/disconnect", "stale/busy/provider/server/load/missing-Session fault matrix", "credential redaction", "history and destructive-state screenshots"];
}

async function sendGitHubPing(page, origin, secret, delivery) {
  const body = Buffer.from(JSON.stringify({ zen: "sanitized acceptance" }));
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const response = await page.request.fetch(`${origin}/api/relay/github/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "ping",
      "x-github-delivery": delivery,
      "x-hub-signature-256": `sha256=${signature}`,
    },
    data: body,
  });
  return response.status();
}

async function assertRelayTextContrast(page) {
  const failures = await page.locator("[data-relay-management-root]").evaluate(root => {
    const parse = value => {
      const match = value.match(/rgba?\((?:\s*)([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\)/u);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
    };
    const blend = (front, back) => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [0, 1, 2].map(index => (front[index] * front[3] + back[index] * back[3] * (1 - front[3])) / alpha).concat(alpha);
    };
    const background = element => {
      const chain = [];
      for (let node = element; node instanceof Element; node = node.parentElement) chain.push(node);
      let result = [255, 255, 255, 1];
      for (const node of chain.reverse()) {
        const value = parse(getComputedStyle(node).backgroundColor);
        if (value && value[3] > 0) result = blend(value, result);
      }
      return result;
    };
    const luminance = rgb => {
      const channels = rgb.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const contrast = (a, b) => {
      const values = [luminance(a), luminance(b)].sort((left, right) => right - left);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    return [...root.querySelectorAll("button, label, p, small, span, strong, dt, dd, h3")].flatMap(element => {
      if (!(element instanceof HTMLElement) || element.hidden || element.matches(":disabled")) return [];
      if (element.getClientRects().length === 0 || getComputedStyle(element).visibility === "hidden") return [];
      const directText = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent ?? "").join(" ").trim();
      if (!directText) return [];
      const style = getComputedStyle(element);
      const foreground = parse(style.color);
      const bg = background(element);
      if (!foreground) return [{ text: directText.slice(0, 80), ratio: 0, color: style.color, background: bg }];
      const effectiveForeground = foreground[3] < 1 ? blend(foreground, bg) : foreground;
      const ratio = contrast(effectiveForeground, bg);
      const fontSize = Number.parseFloat(style.fontSize);
      const weight = Number.parseInt(style.fontWeight, 10) || (style.fontWeight === "bold" ? 700 : 400);
      const threshold = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700) ? 3 : 4.5;
      return ratio + 0.01 < threshold ? [{ text: directText.slice(0, 80), ratio: Number(ratio.toFixed(2)), threshold,
        color: style.color, background: bg.slice(0, 3).map(value => Math.round(value)) }] : [];
    });
  });
  assert.deepEqual(failures, [], "Relay management text must meet WCAG AA contrast");
}

async function sendGmailPush(page, origin, token, account, historyId) {
  const data = Buffer.from(JSON.stringify({ emailAddress: account, historyId })).toString("base64");
  const response = await page.request.fetch(`${origin}/api/relay/email/gmail/push`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    data: JSON.stringify({ message: { messageId: `ui-email-${historyId}`, data } }),
  });
  return response.status();
}

async function focusByTab(page, locator, limit = 100) {
  await locator.waitFor({ state: "visible", timeout: 10_000 });
  await locator.scrollIntoViewIfNeeded();
  const handle = await locator.elementHandle();
  assert.ok(handle, "keyboard target must exist");
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press("Tab");
    if (await handle.evaluate(node => document.activeElement === node).catch(() => false)) return;
  }
  throw new Error(`keyboard tab order did not reach ${await handle.getAttribute("aria-label") ?? await handle.innerText()}`);
}

async function focusByTabSelector(page, selector, limit = 100) {
  await page.waitForSelector(selector, { state: "visible", timeout: 10_000 });
  await page.evaluate(selector => document.querySelector(selector)?.scrollIntoView({ block: "center" }), selector);
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(selector => document.activeElement === document.querySelector(selector), selector)) return;
  }
  throw new Error(`keyboard tab order did not reach ${selector}`);
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
