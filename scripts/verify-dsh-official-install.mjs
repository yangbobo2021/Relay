import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareDshLocalWorkspaceLinks } from "./lib/dsh-local-workspace-links.mjs";
import { forbiddenBackendDependencies } from "./lib/dsh-backend-dependencies.mjs";
import { chromium } from "playwright";
import { createServer } from "node:net";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dshRoot = join(root, "upstream", "deepseek-harness");
const dshBin = process.env.DSH_BIN ?? join(dshRoot, "apps", "cli", "lib", "bin.js");
const temporary = await mkdtemp(join(tmpdir(), "relay-official-dsh-"));
const packages = [
  ["fixtures/dsh-event-acceptance", "relay-dsh-event-acceptance-fixture"],
  ["integrations/codex", "relay-dsh-plugin-codex"],
  ["integrations/claude", "relay-dsh-plugin-claude"],
  ["integrations/events", "relay-dsh-plugin-events"],
  ["integrations/semantic-router", "relay-dsh-plugin-semantic-router"],
  ["integrations/monitors", "relay-dsh-plugin-monitors"],
  ["integrations/dsh-workbench", "relay-dsh-plugin-workbench"],
  ["integrations/dsh-files", "relay-dsh-plugin-files"],
  ["integrations/dsh-terminal", "relay-dsh-plugin-terminal"],
];

const cleanBefore = gitStatus();
assert.equal(cleanBefore, "", "official DSH checkout must be clean before install verification");
prepareDshLocalWorkspaceLinks(dshRoot);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});

try {
  const tarballs = new Map(packages.map(([directory, name]) => {
    const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", temporary], {
      cwd: join(root, directory), encoding: "utf8",
    }))[0];
    return [name, join(temporary, packed.filename)];
  }));

  const eventPlugins = ["relay-dsh-plugin-events", "relay-dsh-plugin-semantic-router", "relay-dsh-plugin-monitors"];
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
  await verifyScenario("all-plugins", ["relay-dsh-plugin-workbench", "relay-dsh-plugin-files", "relay-dsh-plugin-terminal", "relay-dsh-plugin-codex", "relay-dsh-plugin-claude", ...eventPlugins], tarballs, 3199);
  }
} finally {
  await browser.close();
  if (process.env.RELAY_VERIFY_KEEP === "1") console.log(`Retained synthetic acceptance profiles: ${temporary}`);
  else await rm(temporary, { recursive: true, force: true });
}

assert.equal(gitStatus(), "", "official DSH checkout changed during install verification");
console.log(`Verified selected isolated/combined plugin scenarios against ${dshBin}.`);

async function verifyScenario(id, selected, tarballs, port) {
  const home = join(temporary, id);
  const env = { ...process.env, DSH_HOME: home, RELAY_DATABASE_PATH: join(home, "events.sqlite"), RELAY_ROUTER_PROVIDER: "", RELAY_ROUTER_MODEL: "" };
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
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  try {
    await waitFor(() => output.includes(`http://127.0.0.1:${port}`) || child.exitCode !== null, 20_000);
    assert.equal(child.exitCode, null, `${id}: DSH Host exited before serving\n${output}`);
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
    for (const name of selected) {
      if (["relay-dsh-plugin-monitors", "relay-dsh-plugin-semantic-router", "relay-dsh-event-acceptance-fixture"].includes(name)) continue;
      const asset = await fetch(`http://127.0.0.1:${port}/plugins/${name}/client.js`);
      assert.equal(asset.ok, true, `${id}: ${name} client asset is unavailable`);
    }
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
      await page.locator("button").first().waitFor({ timeout: 20_000 });
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
    } finally {
      await page.close();
    }
  } finally {
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
