import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dsh = resolve(process.env.DSH_ROOT ?? join(root, "upstream/deepseek-harness"));
const bin = join(dsh, "apps/cli/lib/bin.js");
const run = await mkdtemp(join(tmpdir(), "relay-codex-coexistence-"));
const home = join(run, "home");
const workspace = join(run, "workspace");
const { startMockLlmServer } = await import(pathToFileURL(join(dsh, "packages/test-support/llm-mock-server/lib/index.js")));
const mock = await startMockLlmServer({ sequence: ["reasoning_success"], repeatLast: true, successText: "NATIVE_RENDER_OK" });
const env = { ...process.env, DSH_HOME: home, RELAY_CODEX_LINK_PATH: join(run, "codex-links.json"),
  RELAY_CLAUDE_LINK_PATH: join(run, "claude-links.json"), DEEPSEEK_BASE_URL: mock.baseURL, DEEPSEEK_API_KEY: "acceptance-fixture-key" };
const results = { dshCommit: shell("git", ["rev-parse", "HEAD"], dsh).trim(), run, cases: [] };
let child, browser, page, base, log = "";
await mkdir(workspace, { recursive: true });
await writeFile(join(workspace, "delivery.txt"), "COEXISTENCE_FIXTURE\n");
console.log(`Coexistence evidence: ${run}`);
try {
  assert.equal(shell("git", ["status", "--short"], dsh).trim(), "");
  const tarballs = [];
  for (const directory of ["integrations/codex", "integrations/claude"]) {
    const [pkg] = JSON.parse(shell("npm", ["pack", "--json", "--pack-destination", run], join(root, directory)));
    tarballs.push(join(run, pkg.filename));
  }
  shell(process.execPath, [bin, "plugin", "--profile", "web", "install"], dsh, env);
  shell(process.execPath, [bin, "plugin", "--profile", "web", "add", ...tarballs], dsh, env);
  const portServer = createServer();
  await new Promise(resolve => portServer.listen(0, "127.0.0.1", resolve));
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["--expose-internals", bin, "web", "--no-open", "--host", "127.0.0.1", "--port", String(port)],
    { cwd: dsh, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", chunk => { log += chunk; });
  child.stderr.on("data", chunk => { log += chunk; });
  await waitFor(() => log.includes(base) || child.exitCode !== null, 40_000);
  assert.equal(child.exitCode, null, log);
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const { workspace: project } = await rpc("workspace.create", { path: workspace });
  const { presets } = await rpc("agentPreset.list", {});
  const nativePreset = presets.find(preset => preset.isDefault && !preset.id.startsWith("relay-"))
    ?? presets.find(preset => !preset.id.startsWith("relay-") && !preset.broken);
  assert.ok(nativePreset, 'native DSH preset must remain installed');
  const native = await createSession(project.workspaceId, nativePreset.id, "Native rendering acceptance");
  await rpc("session.selectModel", { sessionId: native, provider: "deepseek-official", model: "deepseek-v4-flash" });
  await prompt(native, "Return the native rendering fixture.");
  await completed(native);
  await openSession("Native rendering acceptance", "NATIVE_RENDER_OK");
  await assertNative("native", "NATIVE_RENDER_OK");
  pass("Native DSH: official adapter + deterministic HTTP/SSE provider, native rendering/reload untouched");

  const claude = await createSession(project.workspaceId, "relay-claude", "Claude rendering acceptance");
  const claudeModels = await rpc("session.models", { sessionId: claude });
  const claudeCatalog = claudeModels.groups.find(group => group.id === 'relay-claude');
  const claudeModel = claudeCatalog?.models.find(model => model.id === 'sonnet') ?? claudeCatalog?.models[0];
  assert.ok(claudeModel, 'Claude must advertise a model in its own provider group');
  results.claudeModel = (await rpc('session.selectModel', { sessionId: claude, provider: 'relay-claude', model: claudeModel.id })).selected;
  await prompt(claude, "Read delivery.txt in this directory, then reply exactly CLAUDE_RENDER_OK. Do not modify files.");
  await completed(claude);
  const claudeHistory = await rpc('session.history', { sessionId: claude });
  const claudeSource = claudeHistory.events.filter(({ event }) => event.type === 'assistant/message').at(-1)?.event.data.message.source;
  assert.equal(claudeSource?.provider, 'relay-claude');
  assert.ok(claudeSource.replayState?.claudeSessionId, 'real Claude SDK provenance is required');
  await openSession("Claude rendering acceptance", "CLAUDE_RENDER_OK");
  await assertNative("claude", "CLAUDE_RENDER_OK");
  pass("Real Claude SDK read + answer + reload: no Codex grouping or hidden native content");

  const codex = await createSession(project.workspaceId, "relay-codex", "Codex coexistence acceptance");
  await rpc("session.selectModel", { sessionId: codex, provider: "relay-codex", model: "gpt-5.6-sol", reasoningEffort: "high" });
  await prompt(codex, "Read delivery.txt in this directory, then reply exactly CODEX_COEXIST_OK. Do not modify files.");
  await completed(codex);
  await openSession("Codex coexistence acceptance", "CODEX_COEXIST_OK");
  assert.ok(await page.locator('[data-codex-process-turn]').count() > 0);
  assert.equal(await page.locator('[data-codex-final-answer]').innerText(), 'CODEX_COEXIST_OK');
  await page.screenshot({ path: join(run, "codex.png") });
  await openSession("Native rendering acceptance", "NATIVE_RENDER_OK");
  await assertNative("native-after-codex", "NATIVE_RENDER_OK");
  await openSession("Claude rendering acceptance", "CLAUDE_RENDER_OK");
  await assertNative("claude-after-codex", "CLAUDE_RENDER_OK");
  assert.deepEqual(errors, []);
  pass("Switch Codex -> native -> Claude: turn ownership isolated, zero browser errors");
} catch (error) {
  results.error = error.stack;
  if (page) {
    await page.screenshot({ path: join(run, "failure.png") }).catch(() => {});
    await writeFile(join(run, "failure-aria.txt"), await page.locator('body').ariaSnapshot().catch(() => ''));
  }
  throw error;
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const done = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGINT');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    await done; clearTimeout(timer);
  }
  await browser?.close(); await mock.close();
  await writeFile(join(run, "result.json"), JSON.stringify(results, null, 2));
  await writeFile(join(run, "host.log"), log);
  assert.equal(shell("git", ["status", "--short"], dsh).trim(), "");
}
function shell(command, args, cwd = root, environment = process.env) {
  return execFileSync(command, args, { cwd, env: environment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 20 * 1024 * 1024 });
}
async function rpc(method, payload) {
  const body = await (await fetch(`${base}/api/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload }) })).json();
  assert.equal(body.result?.ok, true, `${method}: ${JSON.stringify(body)}`);
  return body.result.value;
}
async function createSession(workspaceId, agentPreset, title) {
  const { sessionId } = await rpc('session.create', { workspaceId, agentPreset });
  await rpc('session.rename', { sessionId, title });
  return sessionId;
}
async function prompt(sessionId, text) {
  await rpc('session.prompt', { sessionId, mode: 'queue', content: [{ type: 'text', text }] });
}
async function completed(sessionId) {
  await waitFor(async () => {
    const { events } = await rpc('session.history', { sessionId });
    const ended = events.find(({ event }) => event.type === 'turn/end');
    if (!ended) return false;
    assert.equal(ended.event.data.reason.kind, 'completed', JSON.stringify(ended.event));
    return true;
  }, 240_000);
}
async function openSession(title, answer) {
  await page.goto(base, { waitUntil: 'networkidle' });
  for (let i = 0; i < 4; i++) {
    const button = page.getByRole('button', { name: /^(Configure later|Continue|稍后配置|继续)$/ }).first();
    if (!await button.isVisible()) break;
    await waitFor(async () => !await button.isVisible() || await button.isEnabled({ timeout: 250 }).catch(() => false), 15_000);
    if (await button.isVisible()) {
      await button.click({ timeout: 1000 }).catch(async error => {
        if (await button.isVisible()) throw error;
      });
    }
  }
  await page.getByText(title, { exact: true }).first().click();
  await page.getByText(answer, { exact: true }).first().waitFor({ timeout: 20_000 });
}
async function assertNative(label, answer) {
  assert.equal(await page.locator('[data-codex-process-turn]').count(), 0);
  assert.ok(await page.locator('[data-chat-flow-kind="assistant-step"]:visible').count() > 0);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText(answer, { exact: true }).first().waitFor();
  assert.equal(await page.locator('[data-codex-process-turn]').count(), 0);
  await page.screenshot({ path: join(run, `${label}.png`) });
}
function pass(name) { results.cases.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function waitFor(predicate, timeout) {
  const end = Date.now() + timeout;
  while (!await predicate()) {
    if (Date.now() > end) throw new Error(`Timed out after ${timeout}ms`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
