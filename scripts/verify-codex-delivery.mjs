import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// A separate test browser/profile. Never attaches to the user's DSH or browser.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dsh = resolve(process.env.DSH_ROOT ?? join(root, "upstream/deepseek-harness"));
const bin = join(dsh, "apps/cli/lib/bin.js");
const run = await mkdtemp(join(tmpdir(), "relay-codex-delivery-"));
const artifacts = resolve(process.env.CODEX_DELIVERY_ARTIFACTS ?? join(run, "artifacts"));
const home = join(run, "home");
const workspace = join(run, "workspace");
const env = { ...process.env, DSH_HOME: home, RELAY_CODEX_LINK_PATH: join(run, "links.json") };
const results = { dshCommit: shell("git", ["rev-parse", "HEAD"], dsh).trim(), run, cases: [] };
let child, browser, page, base, output = "";
await mkdir(artifacts, { recursive: true });
await mkdir(workspace, { recursive: true });
await writeFile(join(workspace, "delivery.txt"), "DELIVERY_BEFORE\n");
// A valid, deterministic PNG for the live image-view tool; not an AI-generation claim.
const sharp = (await import("sharp")).default;
await sharp({ create: { width: 320, height: 180, channels: 3, background: "#23885c" } })
  .png().toFile(join(workspace, "sample.png"));
console.log(`Acceptance artifacts: ${artifacts}\nIsolated profile: ${home}`);

try {
  assert.equal(shell("git", ["status", "--short"], dsh).trim(), "", "official reference must be clean");
  const baseline = await pack("relay-dsh-plugin-codex@0.1.4", "baseline", run);
  const candidate = await pack(null, "candidate", join(root, "integrations/codex"));
  shell(process.execPath, [bin, "plugin", "--profile", "web", "install"], dsh, env);
  await install(baseline);
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await boot();
  const { workspace: project } = await rpc("workspace.create", { path: workspace });
  const { sessionId } = await rpc("session.create", { workspaceId: project.workspaceId, agentPreset: "relay-codex" });
  results.sessionId = sessionId;
  await rpc("session.rename", { sessionId, title: "Delivery acceptance" });
  await rpc("session.selectModel", { sessionId, provider: "relay-codex", model: "gpt-5.6-sol", reasoningEffort: "high" });
  await prompt(sessionId, "Reply with exactly PRE_UPGRADE_OK. Do not call any tools.");
  await completed(sessionId, 1);
  await openSession();
  assert.match(await page.locator("body").innerText(), /PRE_UPGRADE_OK/);
  await capture("01-baseline");
  pass("Published 0.1.4: real Sol High baseline persisted and rendered");

  await stop();
  await install(candidate);
  const installed = join(home, "profiles/web/node_modules/relay-dsh-plugin-codex");
  assert.ok((await realpath(installed)).startsWith(await realpath(run)), "candidate must not resolve to the developer workspace");
  const bundle = await readFile(join(installed, "lib/client.js"));
  assert.equal(hash(bundle), hash(await readFile(join(root, "integrations/codex/lib/client.js"))));
  results.clientSha256 = hash(bundle);
  await boot();
  await openSession();
  assert.match(await page.locator("body").innerText(), /PRE_UPGRADE_OK/);
  await rpc("session.history", { sessionId });
  pass("Upgrade: real candidate tarball identity and old history after cold restart");

  const task = "This is a controlled UI acceptance test. Work only in the current directory. "
    + "Give a short progress message, read delivery.txt, then use apply_patch to replace DELIVERY_BEFORE with DELIVERY_AFTER. "
    + "Use the image-view tool to inspect sample.png. Shell reads are allowed. Run a separate shell command that prints EXPECTED_FAILURE and exits with code 7; "
    + "this failure is intentional, do not retry it. Then read delivery.txt to verify it. "
    + "Finish with DELIVERY_COMPLETE and the produced filename `delivery.txt` as inline code, not a Markdown link. Do not use other projects.";
  await prompt(sessionId, task);
  await page.locator('[data-codex-process-turn][data-status="running"]').waitFor({ timeout: 60_000 });
  await page.locator('[data-codex-activity-group]').first().waitFor({ timeout: 120_000 });
  await capture("02-live");
  await completed(sessionId, 2);
  const processView = page.locator('[data-codex-process-turn]').last();
  await processView.locator('[data-codex-final-answer]').waitFor({ timeout: 20_000 });
  assert.match(await readFile(join(workspace, "delivery.txt"), "utf8"), /DELIVERY_AFTER/);
  assert.match(await processView.innerText(), /DELIVERY_COMPLETE/);
  assert.equal(await processView.locator(':scope > button').getAttribute("aria-expanded"), "false");
  await capture("03-complete");
  const fileButton = processView.locator('[data-codex-final-answer]').getByRole('button', { name: /Open .*delivery\.txt/ });
  const opened = page.waitForResponse(response => response.url().endsWith('/api/host.openPath'));
  await fileButton.click();
  const openResult = await (await opened).json();
  assert.equal(openResult.result?.value?.opened, true, 'produced file must reach the real DSH/OS opener');
  const imageElement = processView.locator('img[alt="sample.png"]');
  await imageElement.waitFor();
  assert.ok(await imageElement.evaluate(element => element.complete && element.naturalWidth === 320 && element.naturalHeight === 180));
  pass('Produced-file button opens through DSH; image attachment decodes at its actual dimensions');
  await keyboardToggle(processView.locator(':scope > button'));
  await processView.locator(':scope > button').press("Enter");
  const groups = processView.locator('[data-codex-activity-group]');
  for (let i = 0; i < await groups.count(); i++) {
    const control = groups.nth(i).locator(':scope > button');
    await keyboardToggle(control);
    await control.press("Enter");
  }
  const edit = processView.locator('[data-codex-activity="fileChange"]').first();
  const image = processView.locator('[data-codex-activity="imageView"]').first();
  assert.ok(await edit.count() > 0, "real edit must render as file activity");
  assert.ok(await image.count() > 0, "real view must render as image activity");
  const failed = processView.locator('[data-codex-activity="commandExecution"][data-status="error"]').first();
  assert.ok(await failed.count() > 0, "intentional exit 7 must not render as success");
  await keyboardToggle(failed.getByRole("button").first());
  await failed.getByRole("button").first().press("Enter");
  assert.match(await failed.innerText(), /EXPECTED_FAILURE/);
  assert.match(await failed.innerText(), /exit 7/);
  const finished = await rpc('session.history', { sessionId });
  const failedResult = finished.events.map(({ event }) => event.data?.meta?.codexActivity?.activity)
    .find(activity => activity?.exitCode === '7');
  assert.match(failedResult?.output ?? '', /EXPECTED_FAILURE/, 'failure output, not merely echoed command input');
  await capture("04-expanded-error");
  pass("Real edit/image-view/nonzero exit, and native Enter/Space at all disclosure levels");

  const finalText = await processView.locator('[data-codex-final-answer]').innerText();
  await page.reload({ waitUntil: "networkidle" });
  await processView.locator('[data-codex-final-answer]').waitFor();
  assert.equal(await processView.locator('[data-codex-final-answer]').innerText(), finalText);
  assert.equal(await processView.locator(':scope > button').getAttribute("aria-expanded"), "false");
  await capture("05-reloaded");
  pass("Candidate history reload preserves the complete answer and collapsed process");

  // Test the conversation reading state, not an intentionally expanded shell sidebar.
  const collapseSidebar = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  if (await collapseSidebar.isVisible()) await collapseSidebar.click();
  await page.setViewportSize({ width: 390, height: 844 });
  // DSH retains a 56px icon rail plus conversation gutters at this width.
  await waitFor(async () => (await processView.boundingBox())?.width >= 240, 10_000);
  await processView.locator(':scope > button').press("Enter");
  await processView.locator('[data-codex-activity-group] > button').first().press("Enter");
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  assert.ok(overflow.scroll <= overflow.width + 1, `mobile document overflow: ${JSON.stringify(overflow)}`);
  const imageBounds = await imageElement.boundingBox();
  assert.ok(imageBounds.width >= 200 && imageBounds.x >= 0 && imageBounds.x + imageBounds.width <= 390,
    `mobile image must remain readable and inside viewport: ${JSON.stringify(imageBounds)}`);
  await capture("06-mobile-390");
  pass("390 x 844 mobile reading viewport: native sidebar collapsed, readable groups/image, no horizontal overflow");
  await page.setViewportSize({ width: 1440, height: 960 });

  // Raw first-yield subscription is immutable Thread creation state in this
  // Codex runtime. Keep upgrade continuity, but test the new capability on a new Thread.
  const { sessionId: cancelSessionId } = await rpc('session.create', { workspaceId: project.workspaceId, agentPreset: 'relay-codex' });
  results.cancelSessionId = cancelSessionId;
  await rpc('session.rename', { sessionId: cancelSessionId, title: 'Cancellation acceptance' });
  await rpc('session.selectModel', { sessionId: cancelSessionId, provider: 'relay-codex', model: 'gpt-5.6-sol', reasoningEffort: 'high' });
  await prompt(cancelSessionId, "Run a shell command that prints CANCEL_PARTIAL_OK, writes CANCEL_READY to cancel-marker.txt, then sleeps for 90 seconds. Use exec_command yield_time_ms: 1000 and return its complete result with text(result), so stdout is delivered before stopping. After that first yield, report COMMAND_WAITING as a commentary update and use write_stdin to wait on that process. Do not run other commands or retry. I will stop it.");
  await openSession('Cancellation acceptance', null);
  await waitFor(async () => {
    return (await readFile(join(workspace, 'cancel-marker.txt'), 'utf8').catch(() => '')).includes('CANCEL_READY')
      && await page.locator('[data-codex-process-turn][data-status="running"] [data-codex-commentary]').filter({ hasText: 'COMMAND_WAITING' }).count() > 0;
  }, 120_000);
  await page.getByRole("button", { name: /Stop generating|停止生成/ }).click();
  await completed(cancelSessionId, 1);
  const cancelled = await rpc('session.history', { sessionId: cancelSessionId });
  const partial = cancelled.events.filter(({ event }) => event.type === 'tool/result')
    .at(-1)?.event.data.meta?.codexActivity?.activity;
  assert.equal(partial?.status, 'error');
  assert.match(partial.output ?? '', /CANCEL_PARTIAL_OK/, 'must retain actual buffered stdout, not only the command text');
  const stopped = page.locator('[data-codex-process-turn]').last();
  assert.equal(await stopped.getAttribute("data-status"), "error");
  if (await stopped.locator(':scope > button').getAttribute("aria-expanded") !== "true") await stopped.locator(':scope > button').click();
  await stopped.locator('[data-codex-activity-group] > button').first().click();
  await stopped.locator('[data-codex-activity]').first().getByRole('button').first().click();
  assert.match(await stopped.innerText(), /CANCEL_PARTIAL_OK/);
  await capture("07-cancelled");
  pass("Real UI stop settles the active command and preserves partial output");
  await stop();
  await boot();
  await openSession();
  await openSession('Cancellation acceptance', 'COMMAND_WAITING');
  assert.ok(await page.locator('[data-codex-process-turn][data-status="error"]').count() > 0);
  pass("Cold restart: cancelled and completed candidate histories load without unsupported events");
} catch (error) {
  results.error = error.stack;
  if (page && !page.isClosed()) {
    await capture("failure").catch(() => {});
    await writeFile(join(artifacts, "failure-dom.txt"), await page.locator("body").innerText().catch(() => ""));
    await writeFile(join(artifacts, "failure-aria.txt"), await page.locator("body").ariaSnapshot().catch(() => ""));
  }
  throw error;
} finally {
  await stop();
  await browser?.close();
  await writeFile(join(artifacts, "result.json"), JSON.stringify(results, null, 2));
  await writeFile(join(run, "host.log"), output);
  assert.equal(shell("git", ["status", "--short"], dsh).trim(), "", "official reference changed");
}

function shell(command, args, cwd = root, environment = process.env) {
  return execFileSync(command, args, { cwd, env: environment, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 20 * 1024 * 1024 });
}
async function pack(spec, directory, cwd) {
  const dest = join(run, directory);
  await mkdir(dest);
  const [info] = JSON.parse(shell("npm", ["pack", ...(spec ? [spec] : []), "--json", "--pack-destination", dest], cwd));
  return join(dest, info.filename);
}
async function install(tarball) {
  shell(process.execPath, [bin, "plugin", "--profile", "web", "add", tarball], dsh, env);
}
async function boot() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  base = `http://127.0.0.1:${port}`;
  let fresh = "";
  child = spawn(process.execPath, ["--expose-internals", bin, "web", "--no-open", "--host", "127.0.0.1", "--port", String(port)],
    { cwd: dsh, env, stdio: ["ignore", "pipe", "pipe"] });
  const record = chunk => { fresh += chunk; output += chunk; };
  child.stdout.on("data", record); child.stderr.on("data", record);
  await waitFor(() => fresh.includes(base) || child.exitCode !== null, 40_000);
  assert.equal(child.exitCode, null, fresh);
}
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once("exit", resolve));
  child.kill("SIGINT");
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  await exited; clearTimeout(timer);
}
async function rpc(method, payload) {
  const response = await fetch(`${base}/api/${method}`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "client-request", rpcId: randomUUID(), method, payload }) });
  const body = await response.json();
  assert.equal(body.result?.ok, true, `${method}: ${JSON.stringify(body)}`);
  return body.result.value;
}
async function prompt(sessionId, text) {
  await rpc("session.prompt", { sessionId, mode: "queue", content: [{ type: "text", text }] });
}
async function completed(sessionId, turns) {
  await waitFor(async () => {
    const { events } = await rpc("session.history", { sessionId });
    return events.filter(({ event }) => event.type === "turn/end").length >= turns;
  }, 240_000);
}
async function openSession(sessionTitle = 'Delivery acceptance', expectedText = 'PRE_UPGRADE_OK') {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator("button").first().waitFor();
  for (let i = 0; i < 4; i++) {
    const dismiss = page.getByRole("button", { name: /^(Configure later|Continue|稍后配置|继续)$/ }).first();
    if (!await dismiss.isVisible()) break;
    await waitFor(async () => !await dismiss.isVisible() || await dismiss.isEnabled({ timeout: 250 }).catch(() => false), 15_000);
    if (await dismiss.isVisible()) {
      await dismiss.click({ timeout: 1000 }).catch(async error => {
        if (await dismiss.isVisible()) throw error;
      });
    }
  }
  const openSidebar = page.getByRole('button', { name: 'Open sidebar', exact: true });
  if (await openSidebar.isVisible()) await openSidebar.click();
  const title = page.getByText(sessionTitle, { exact: true }).first();
  await title.waitFor({ timeout: 20_000 });
  await title.click();
  if (expectedText) await page.getByText(expectedText, { exact: true }).first().waitFor({ timeout: 20_000 });
  assert.doesNotMatch(await page.locator("body").innerText(), /Failed to load plugins|history unavailable|历史加载失败/);
}
async function keyboardToggle(button) {
  const initial = await button.getAttribute("aria-expanded");
  assert.ok(initial === "true" || initial === "false");
  await button.focus();
  await page.keyboard.press("Enter");
  assert.notEqual(await button.getAttribute("aria-expanded"), initial, "Enter toggles native button");
  await page.keyboard.press("Space");
  assert.equal(await button.getAttribute("aria-expanded"), initial, "Space toggles native button back");
}
async function capture(name) { await page.screenshot({ path: join(artifacts, `${name}.png`), fullPage: false }); }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function pass(name) { results.cases.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function waitFor(predicate, milliseconds) {
  const until = Date.now() + milliseconds;
  while (!await predicate()) {
    if (Date.now() > until) throw new Error(`Acceptance condition timed out after ${milliseconds}ms`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
