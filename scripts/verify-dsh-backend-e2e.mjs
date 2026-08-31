import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { prepareDshLocalWorkspaceLinks } from './lib/dsh-local-workspace-links.mjs';
import { runExtendedBackendCases } from './lib/dsh-extended-backend-cases.mjs';
import { runWorkbenchCases } from './lib/dsh-workbench-extra-cases.mjs';
import { runManagerCases } from './lib/dsh-manager-extra-cases.mjs';
import { runEventsCases } from './lib/dsh-events-extra-cases.mjs';

// Explicit real-model acceptance. Never reuses a daily DSH Profile or Session.
assert.equal(process.env.DSH_LIVE_BACKEND_ACCEPTANCE, '1', 'Set DSH_LIVE_BACKEND_ACCEPTANCE=1 to authorize real model usage.');
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dsh = resolve(process.env.DSH_ROOT ?? join(root, 'upstream/deepseek-harness'));
const bin = join(dsh, 'apps/cli/lib/bin.js');
let activeBin = process.env.DSH_BASELINE_BIN ? resolve(process.env.DSH_BASELINE_BIN) : bin;
let legacy = Boolean(process.env.DSH_BASELINE_BIN);
const run = await mkdtemp(join(tmpdir(), 'relay-alpha2-backends-'));
const artifacts = resolve(process.env.DSH_BACKEND_ARTIFACT_DIR ?? join(run, 'artifacts'));
const home = join(run, 'home');
const env = { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: join(home, 'agents'),
  RELAY_CODEX_LINK_PATH: join(run, 'codex-links.json'), RELAY_CLAUDE_LINK_PATH: join(run, 'claude-links.json'),
  RELAY_DATABASE_PATH: join(run, 'events.sqlite'), RELAY_ROUTER_PROVIDER: '', RELAY_ROUTER_MODEL: '' };
const backends = (process.env.DSH_BACKEND_NAMES ?? 'codex,claude').split(',');
assert.ok(backends.every(name => ['codex', 'claude'].includes(name)));
if (legacy) assert.equal(backends.length, 1, 'upgrade acceptance uses one backend per isolated Home');
const tasks = (process.env.DSH_BACKEND_TASKS ?? 'smoke').split(',');
const claudeBackend = process.env.DSH_CLAUDE_BACKEND ?? 'sdk';
assert.ok(['sdk', 'cli'].includes(claudeBackend));
const report = { dshCommit: sh('git', ['rev-parse', 'HEAD'], dsh).trim(), createdAt: new Date().toISOString(),
  platform: process.platform, arch: process.arch, node: process.version, claudeBackend, run, packages: [], cases: [], browserErrors: [] };
let browser, context, page, child, base, hostOutput = '';
// Fail before installing or starting a model if evidence from a prior run exists.
await mkdir(dirname(artifacts), { recursive: true });
await mkdir(artifacts, { mode: 0o700 });
try {
  assert.equal(sh('git', ['status', '--short'], dsh).trim(), '', 'official DSH reference must be clean');
  prepareDshLocalWorkspaceLinks(dsh);
  const packs = [];
  for (const directory of new Set(['session-import', ...backends, ...(tasks.includes('workbench') ? ['dsh-workbench', 'dsh-files', 'dsh-terminal'] : []), ...(tasks.includes('events') ? ['events', 'monitors'] : []), ...(tasks.includes('manager') ? ['dsh-plugin-manager', 'dsh-workbench', 'dsh-files'] : [])])) {
    const packed = JSON.parse(sh('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', run], join(root, 'integrations', directory)))[0];
    const path = join(run, packed.filename);
    packs.push({ name: packed.name, path });
    report.packages.push({ name: packed.name, version: packed.version, sha256: sha(await readFile(path)) });
  }
  sh(process.execPath, [activeBin, 'plugin', '--profile', 'web', 'install'], dsh, env);
  const installCandidate = async () => {
    await appendFile(join(home, 'profiles/web/pnpm-workspace.yaml'), '\noverrides:\n' + packs.map(p => `  '${p.name}': file:${p.path}`).join('\n') + '\n');
    sh(process.execPath, [bin, 'plugin', '--profile', 'web', 'add', ...packs.map(p => p.path)], dsh, env);
  };
  if (legacy) {
    const oldPacks = join(run, 'published-baseline'); await mkdir(oldPacks);
    const backendSpec = backends[0] === 'codex' ? 'relay-dsh-plugin-codex@0.1.6-rc.1' : 'relay-dsh-plugin-claude@0.1.5';
    const baselinePacks = ['relay-dsh-plugin-session-import@0.1.0', backendSpec].map(spec => JSON.parse(sh('npm', ['pack', spec, '--ignore-scripts', '--json', '--pack-destination', oldPacks], oldPacks))[0]);
    sh(process.execPath, [activeBin, 'plugin', '--profile', 'web', 'add', ...baselinePacks.map(p => join(oldPacks, p.filename))], dsh, env);
    report.baseline = { dshVersion: JSON.parse(await readFile(join(dirname(activeBin), '../package.json'), 'utf8')).version, packages: [] };
    assert.equal(report.baseline.dshVersion, '0.1.1-rc.2');
    for (const packed of baselinePacks) report.baseline.packages.push({ name: packed.name, version: packed.version, sha256: sha(await readFile(join(oldPacks, packed.filename))) });
  } else await installCandidate();
  if (backends.includes('claude')) {
    await writeFile(join(home, 'profiles/web/cordis.patch.yml'), `- id: relay-claude-host\n  config:\n    claudeBackend: ${claudeBackend}\n`);
    if (claudeBackend === 'cli') report.claudeCliVersion = sh('claude', ['--version'], run).trim();
  }
  report.runtimes = {};
  for (const backend of backends) {
    const require = createRequire(join(home, `profiles/web/node_modules/relay-dsh-plugin-${backend}/package.json`));
    const dependency = backend === 'codex' ? '@openai/codex' : '@anthropic-ai/claude-agent-sdk';
    let manifest;
    try { manifest = require.resolve(`${dependency}/package.json`); }
    catch { manifest = join(dirname(require.resolve(dependency)), 'package.json'); }
    const metadata = JSON.parse(await readFile(manifest, 'utf8'));
    assert.equal(metadata.name, dependency);
    report.runtimes[dependency] = metadata.version;
  }
  await writeFile(join(home, 'settings.yaml'), 'permission:\n  defaultPreset: workspace-write\n');
  console.log(JSON.stringify({ stage: 'packages-installed', runtimes: report.runtimes }));
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  console.log(JSON.stringify({ stage: 'browser-launched' }));
  context = await bounded(browser.newContext({ viewport: { width: 1440, height: 960 } }), 30_000, 'browser context initialization');
  console.log(JSON.stringify({ stage: 'browser-context-ready' }));
  await boot();
  for (const backend of backends) {
    const workspace = join(run, `${backend}-workspace`);
    await mkdir(workspace);
    await writeFile(join(workspace, 'AGENTS.md'), 'This is a synthetic acceptance workspace. Follow the exact user request. Do not read credentials, user configuration, other projects, or other sessions. Do not install software.\n');
    await writeFile(join(workspace, 'CLAUDE.md'), 'Synthetic acceptance workspace. Work only on the requested fixture files. Never inspect credentials, user configuration, other projects, or other sessions.\n');
    const { workspace: registered } = await rpc('workspace/create', { path: workspace });
    const { sessionId } = await rpc('session/create', { workspaceId: registered.workspaceId, agentPreset: `relay-${backend}` });
    const title = `Alpha2 ${backend} acceptance`;
    await rpc('session/rename', { sessionId, title });
    const model = backend === 'codex' ? 'gpt-5.6-sol' : 'sonnet';
    const reasoning = backend === 'claude' && claudeBackend === 'cli' ? {} : { reasoningEffort: 'low' };
    await rpc('session/selectModel', { sessionId, provider: `relay-${backend}`, model, ...reasoning });
    const session = { backend, sessionId, title, workspace, workspaceId: registered.workspaceId, model };
    await follow(session);
    const nonce = `MEM_${randomUUID().slice(0, 8)}`;
    await runCase(`${backend}-smoke`, async record => {
      record.selection = { model, ...reasoning };
      const result = await turn(session, `Remember the synthetic marker ${nonce} for this conversation. Reply with exactly READY_${backend.toUpperCase()}. Do not call any tools.`);
      assert.match(result.text, new RegExp(`READY_${backend.toUpperCase()}`));
      await openSession(session);
      await follow(session);
      await expectVisible(`READY_${backend.toUpperCase()}`);
      record.result = result;
      record.binding = await binding(session);
      await page.screenshot({ path: join(artifacts, `${backend}-smoke.png`) });
    });
    if (!report.cases.at(-1).passed) continue;
    if (legacy && tasks.includes('question')) await runCase(`${backend}-baseline-question`, record => questionCase(session, record));
    if (legacy) {
      await runCase(`${backend}-old-to-new-upgrade`, async record => {
        const originalBinding = await binding(session);
        const oldEvents = await events(session);
        const originalMessages = visibleMessages(oldEvents);
        await stopHost();
        activeBin = bin; legacy = false;
        await installCandidate();
        await boot();
        await openSession(session);
        await follow(session);
        await expectVisible(`READY_${backend.toUpperCase()}`);
        assert.deepEqual(visibleMessages(await events(session)), originalMessages, 'old persisted messages survive upgrade without duplication');
        record.result = await turn(session, 'What synthetic marker did I ask you to remember before this software upgrade? Reply with just the marker. Do not use tools or read files.');
        assert.match(record.result.text, new RegExp(nonce));
        assert.equal(await binding(session), originalBinding);
        await expectVisible(nonce);
        record.bindingPreserved = true; record.oldMessagesPreserved = true;
        await page.screenshot({ path: join(artifacts, `${backend}-old-to-new-upgrade.png`) });
      });
    }
    if (tasks.includes('tools')) await runCase(`${backend}-tools`, async record => {
      const input = '{"values":[2,3,5]}\n';
      await writeFile(join(workspace, 'input.json'), input);
      record.approvals = [];
      record.result = await turn(session, 'Read input.json, sum the values, and write result.json as {"total":the integer sum}. Do not modify input.json or any other file. Use real file tools, then reply TOOLS_COMPLETE.', {
        during: () => approveFixture(session, ['input.json', 'result.json'], true, record.approvals),
      });
      assert.deepEqual(JSON.parse(await readFile(join(workspace, 'result.json'), 'utf8')), { total: 10 });
      assert.equal(await readFile(join(workspace, 'input.json'), 'utf8'), input);
      assert.ok(record.result.activityCount > 0, 'real tool activity must be persisted');
      await expectVisible('TOOLS_COMPLETE');
      await page.screenshot({ path: join(artifacts, `${backend}-tools.png`) });
    });
    if (tasks.includes('approval')) {
      for (const allowed of [true, false]) await runCase(`${backend}-approval-${allowed ? 'allow' : 'deny'}`, async record => {
        const name = `${backend}-${allowed ? 'allowed' : 'denied'}.txt`;
        const target = join(run, name);
        assert.equal(existsSync(target), false);
        record.approvals = [];
        record.result = await turn(session, `Controlled approval test. Make exactly one shell write of APPROVAL_FIXTURE to ${target}, which is outside the workspace but inside this disposable test directory. Request approval${backend === 'codex' ? ' with sandbox_permissions=require_escalated' : ''}. Include the exact filename ${name} in the approval justification/title. Do not change permissions. If rejected, stop without retry or another method.`, {
          during: () => approveFixture(session, [name], allowed, record.approvals, target),
        });
        assert.equal(record.approvals.length, 1, 'one real user-facing approval must be answered');
        assert.equal(existsSync(target), allowed);
        if (allowed) assert.equal((await readFile(target, 'utf8')).trim(), 'APPROVAL_FIXTURE');
        record.sideEffectMatchesDecision = true;
      });
    }
    if (tasks.includes('cancel')) await runCase(`${backend}-cancel`, async record => {
      await writeFile(join(workspace, 'long.mjs'), `import {writeFileSync} from 'node:fs'; writeFileSync('running.json', JSON.stringify({pid:process.pid})); console.log('LONG_STARTED'); setTimeout(()=>{writeFileSync('late-write.txt','BAD'); console.log('LONG_FINISHED')},30000);\n`);
      record.approvals = [];
      let cancelled = false, pid;
      try {
        record.result = await turn(session, 'Execute node long.mjs exactly once in the foreground. It is a controlled cancellation test. Do not detach it, do not retry, and do not start another process. Keep waiting for it; I will press Stop.', {
          during: async () => {
            await approveFixture(session, ['long.mjs'], true, record.approvals);
            if (!cancelled && existsSync(join(workspace, 'running.json'))) {
              pid = JSON.parse(await readFile(join(workspace, 'running.json'), 'utf8')).pid;
              assert.ok(Number.isInteger(pid) && pid > 0);
              await page.getByRole('button', { name: /^(Stop generating|停止生成)$/ }).click({ timeout: 5000 });
              cancelled = true;
            }
          },
        });
        assert.equal(cancelled, true, 'the real Stop button must be used after the process starts');
        await until(() => !alive(pid), 12000);
        assert.equal(existsSync(join(workspace, 'late-write.txt')), false);
        record.childStopped = true;
        record.recovery = await turn(session, 'The cancellation test is finished. Reply exactly CANCEL_RECOVERED without running tools.');
        await expectVisible('CANCEL_RECOVERED');
      } finally {
        // Cleanup is not counted as a successful product cancellation.
        if (pid && alive(pid)) { process.kill(pid, 'SIGTERM'); record.harnessCleanupRequired = true; }
      }
    });
    if (tasks.includes('question')) await runCase(`${backend}-question`, record => questionCase(session, record));
    if (tasks.includes('model') && backend === 'codex') await runCase('codex-model-ui', async record => {
      const originalBinding = await binding(session);
      try {
        await page.getByRole('button', { name: /^Select model, current / }).click();
        await page.getByRole('menuitem', { name: /^Model/ }).click();
        const models = page.getByRole('group', { name: 'Codex', exact: true });
        record.availableModelLabels = await models.getByRole('menuitemradio').allTextContents();
        await models.getByRole('menuitemradio', { name: /terra/i }).click();
        await page.getByRole('button', { name: /^Select model, current .*terra/i }).click();
        await page.getByRole('menuitem', { name: /^Effort/ }).click();
        await page.getByRole('menuitemradio', { name: 'Medium', exact: true }).click();
        record.result = await turn(session, 'Reply with exactly CODEX_MODEL_UI_OK. Do not call tools.', { submitViaUi: true });
        assert.equal(record.result.requestedModel, 'gpt-5.6-terra');
        assert.equal(record.result.requestedReasoningEffort, 'medium');
        await expectVisible('CODEX_MODEL_UI_OK');
        assert.equal(await binding(session), originalBinding);
        await page.getByRole('button', { name: /^Select model, current .*terra.*reasoning effort Medium/i }).waitFor();
        record.bindingPreserved = true;
        await page.screenshot({ path: join(artifacts, 'codex-model-ui.png') });
      } finally {
        await rpc('session/selectModel', { sessionId, provider: 'relay-codex', model, reasoningEffort: 'low' });
      }
    });
    if (tasks.includes('model') && backend === 'claude') await runCase(`${backend}-model-ui`, async record => {
      const originalBinding = await binding(session);
      try {
        await page.getByRole('button', { name: /Select model, current Claude Sonnet/ }).click();
        await page.getByRole('menuitem', { name: /^Model/ }).click();
        await page.getByRole('menuitemradio', { name: 'Claude Haiku', exact: true }).click();
        record.result = await turn(session, 'Reply with exactly MODEL_UI_OK. Do not call tools.', { submitViaUi: true });
        assert.equal(record.result.requestedModel, 'haiku');
        await expectVisible('MODEL_UI_OK');
        assert.equal(await binding(session), originalBinding);
        await page.getByRole('button', { name: /Select model, current Claude Haiku/ }).waitFor();
        await page.screenshot({ path: join(artifacts, `${backend}-model-ui.png`) });
        record.bindingPreserved = true;
      } finally {
        await rpc('session/selectModel', { sessionId, provider: 'relay-claude', model: 'sonnet', reasoningEffort: 'low' });
      }
    });
    await runExtendedBackendCases({ session, nonce, tasks, runCase, turn, rpc, events, binding, openSession, follow,
      getPage: () => page, getContext: () => context, getBase: () => base, boot, stopHost, artifacts, run, home, root });
    if (tasks.includes('workbench')) await runWorkbenchCases({ session, runCase, rpc, turn, openSession, follow,
      getPage: () => page, getContext: () => context, artifacts, run, boot, stopHost });
    if (tasks.includes('events')) await runEventsCases({ session, runCase, rpc, turn, events, binding, openSession, follow,
      getPage: () => page, getContext: () => context, getBase: () => base, artifacts, boot, stopHost });
    if (tasks.includes('manager')) await runManagerCases({ session, runCase, turn, openSession, follow, getPage: () => page, home, artifacts });
    if (tasks.includes('memory')) await runCase(`${backend}-restart-memory`, async record => {
      const originalBinding = await binding(session);
      await page.reload({ waitUntil: 'networkidle' });
      await expectVisible(`READY_${backend.toUpperCase()}`);
      await stopHost();
      await boot();
      await openSession(session);
      await expectVisible(`READY_${backend.toUpperCase()}`);
      await follow(session);
      const result = await turn(session, 'What synthetic marker did I ask you to remember? Reply with just that marker. Do not use any tools or read files.');
      assert.match(result.text, new RegExp(nonce));
      assert.equal(await binding(session), originalBinding, 'restart must preserve the backend Session/Thread binding');
      await expectVisible(nonce);
      record.result = result; record.bindingPreserved = true;
      await page.screenshot({ path: join(artifacts, `${backend}-restart-memory.png`) });
    });
  }
} catch (error) {
  report.setupError = redact(error.stack ?? String(error)); process.exitCode = 1;
} finally {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(artifacts, 'last-state.png') }).catch(() => {});
    await writeFile(join(artifacts, 'last-state.txt'), await page.locator('body').innerText().catch(() => ''));
  }
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await stopHost();
  await writeFile(join(artifacts, 'host.log'), redact(hostOutput));
  await save();
  assert.equal(sh('git', ['status', '--short'], dsh).trim(), '', 'official DSH reference changed');
  console.log(JSON.stringify({ artifacts, cases: report.cases.map(c => ({ id: c.id, passed: c.passed, error: c.error })), setupError: report.setupError }));
}
if (report.cases.some(c => !c.passed)) process.exitCode = 1;

async function boot() {
  let output = '';
  child = spawn(process.execPath, ['--expose-internals', activeBin, 'web', '--no-open', '--host', '127.0.0.1', '--port', '0'], { cwd: dsh, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const collect = chunk => { output += chunk; hostOutput += chunk; };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  await until(() => (legacy ? /http:\/\/127\.0\.0\.1:\d+/.test(output) : /http:\/\/127\.0\.0\.1:\d+\/\?token=/.test(output)) || child.exitCode !== null, 45_000);
  assert.equal(child.exitCode, null, redact(output));
  const launch = output.match(legacy ? /http:\/\/127\.0\.0\.1:\d+(?:\/\?token=[^\s]+)?/ : /http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/)[0];
  base = new URL(launch).origin;
  await context.request.get(launch);
  if (page) await page.close();
  page = await context.newPage();
  page.on('pageerror', error => report.browserErrors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('button').first().waitFor({ timeout: 15000 });
  await dismissWelcome();
}
async function dismissWelcome() {
  const welcome = page.getByRole('button', { name: /^(Configure later|Continue|稍后配置|继续)$/ }).first();
  await welcome.waitFor({ timeout: 2000 }).catch(() => {});
  for (let i = 0; i < 5; i++) {
    const dialog = page.getByRole('dialog').first();
    if (!await dialog.isVisible()) break;
    const button = dialog.getByRole('button', { name: /^(Configure later|Continue|稍后配置|继续)$/ }).first();
    await button.click({ timeout: 15000 });
    await page.waitForTimeout(300);
  }
}
async function stopHost() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise(done => child.once('close', done));
  child.kill('SIGINT'); const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
  await closed; clearTimeout(timeout);
}
async function rpc(method, request, directArgs = false) {
  const endpoint = legacy ? method.replace('/', '.') : method;
  const response = await context.request.post(`${base}/api/${endpoint}`, { data: { type: 'client-request', rpcId: randomUUID(), method: endpoint, payload: legacy ? request : { args: directArgs ? request : { request } } } });
  assert.equal(response.status(), 200, `${method}: HTTP ${response.status()}`);
  const body = await response.json();
  assert.equal(body.result?.ok, true, `${method}: ${JSON.stringify(body)}`);
  return body.result.value;
}
async function openSession(session) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const sidebar = page.getByRole('button', { name: 'Open sidebar', exact: true });
  if (await sidebar.isVisible()) await sidebar.click();
  await page.getByText(basename(session.workspace), { exact: true }).first().waitFor({ timeout: 15000 });
  await dismissWelcome();
  await page.getByText(session.title, { exact: true }).first().waitFor({ timeout: 2000 }).catch(() => {});
  if (!await page.getByText(session.title, { exact: true }).first().isVisible()) {
    await page.getByText(basename(session.workspace), { exact: true }).first().click({ timeout: 15000 });
  }
  await page.getByText(session.title, { exact: true }).first().click({ timeout: 15000 });
}
async function follow(session) {
  if (legacy) return;
  await page.evaluate(async sessionId => {
    window.__acceptanceFollows ??= {};
    const state = { records: [], error: null, ready: false };
    window.__acceptanceFollows[sessionId] = state;
    const socket = new WebSocket(`${location.origin.replace('http:', 'ws:')}/api/remote.mux`);
    state.socket = socket;
    const streamId = crypto.randomUUID();
    socket.onopen = () => socket.send(JSON.stringify({ type: 'open', streamId, endpoint: 'session/follow', payload: { args: { request: { address: { kind: 'session', sessionId }, maxMessages: 100 } } } }));
    socket.onerror = () => { state.error = 'history WebSocket error'; };
    socket.onmessage = message => {
      const frame = JSON.parse(message.data);
      if (frame.type === 'error') state.error = JSON.stringify(frame.error);
      if (frame.type !== 'item') return;
      const item = frame.value;
      if (item.type === 'snapshot') { state.records = item.records; state.ready = true; }
      else state.records.push(item);
    };
  }, session.sessionId);
  await until(async () => {
    const state = await page.evaluate(id => ({ ready: window.__acceptanceFollows[id].ready, error: window.__acceptanceFollows[id].error }), session.sessionId);
    assert.equal(state.error, null); return state.ready;
  }, 15_000);
}
async function events(session) {
  if (legacy) return (await rpc('session/history', { sessionId: session.sessionId })).events.map(record => record.event);
  return await page.evaluate(id => window.__acceptanceFollows[id].records.map(record => record.event), session.sessionId);
}
function visibleMessages(events) {
  return events.filter(e => ['user/message', 'assistant/message'].includes(e.type)).map(e => ({ type: e.type, data: e.data }));
}
async function turn(session, text, { during, submitViaUi = false, content } = {}) {
  const previous = await events(session);
  const count = previous.filter(e => e.type === 'turn/end').length;
  const after = previous.at(-1)?.seq ?? -1;
  const start = Date.now();
  if (submitViaUi) {
    const editor = page.locator('[contenteditable="true"][role="textbox"]');
    await editor.fill(text);
    await editor.press('Enter');
  } else await rpc('session/prompt', { sessionId: session.sessionId, requestId: randomUUID(), mode: 'queue', content: content ?? [{ type: 'text', text }] });
  try {
    await until(async () => {
      if (during) await during();
      return (await events(session)).filter(e => e.type === 'turn/end').length > count;
    }, 180_000);
  } catch (error) { await rpc('session/cancel', { sessionId: session.sessionId }).catch(() => {}); throw error; }
  const recorded = (await events(session)).filter(e => e.seq > after);
  await writeFile(join(artifacts, `${session.backend}-${count + 1}-history.json`), JSON.stringify(recorded, null, 2));
  const end = recorded.findLast(e => e.type === 'turn/end')?.data;
  assert.notEqual(end?.reason?.kind, 'error', JSON.stringify(end));
  const messageText = recorded.filter(e => e.type === 'assistant/message').flatMap(e => e.data.message?.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  return { elapsedMs: Date.now() - start, end, text: messageText, requestedModel: recorded.find(e => e.type === 'request/header')?.data?.header?.config?.model,
    requestedReasoningEffort: recorded.find(e => e.type === 'request/header')?.data?.header?.config?.reasoningEffort,
    eventTypes: [...new Set(recorded.map(e => e.type))], activityCount: recorded.filter(e => e.type === 'relay-claude/activity' || e.data?.meta?.codexActivity).length };
}
async function approveFixture(session, names, allowed, records, target) {
  const approval = page.locator('[data-approval-key]').first();
  if (!await approval.isVisible()) return;
  const key = await approval.getAttribute('data-approval-key');
  if (records.some(record => record.key === key)) return;
  const reason = await approval.innerText();
  const matches = names.some(name => reason.includes(name));
  if (!matches) {
    await approval.getByRole('button', { name: /^(Reject|拒绝)$/ }).click();
    throw new Error('Rejected unexpected approval outside the named fixture operation: ' + reason);
  }
  if (target) assert.equal(existsSync(target), false, 'no side effect before the approval answer');
  const screenshotKey = String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
  await page.screenshot({ path: join(artifacts, `${session.backend}-${screenshotKey}-${allowed ? 'allow' : 'deny'}.png`) });
  records.push({ key, allowed, reason });
  await approval.getByRole('button', { name: allowed ? /^(Allow once|允许一次)$/ : /^(Reject|拒绝)$/ }).click();
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } }
async function questionCase(session, record) {
  let answered = false;
  record.result = await turn(session, `Use ${session.backend === 'claude' ? 'AskUserQuestion' : 'request_user_input'} once to ask "Choose a fixture option" with exactly the choices ALPHA and BETA. Wait for my answer. Then reply with CHOICE_ followed by the selected option. Do not use any other tools.`, {
    during: async () => {
      const question = page.locator('[data-question-key]').first();
      if (answered || !await question.isVisible()) return;
      await question.getByRole('radio', { name: 'BETA', exact: true }).click();
      await page.screenshot({ path: join(artifacts, `${record.id}.png`) });
      await question.getByRole('button', { name: /^(Submit|提交)$/ }).click();
      answered = true;
    },
  });
  assert.equal(answered, true, 'a real question must be answered through the UI');
  assert.match(record.result.text, /CHOICE_BETA/);
  await expectVisible('CHOICE_BETA');
}
async function binding(session) {
  const data = JSON.parse(await readFile(join(run, `${session.backend}-links.json`), 'utf8'));
  const value = data.sessions?.[session.sessionId];
  assert.ok(value, 'backend binding must exist');
  const id = value.threadId ?? value.claudeSessionId ?? value.sessionId;
  assert.ok(id, `unknown binding fields: ${Object.keys(value).join(',')}`);
  return id;
}
async function expectVisible(text) { await page.getByText(text, { exact: true }).first().waitFor({ timeout: 20_000 }); }
async function runCase(id, fn) {
  if (process.env.DSH_BACKEND_CASE_FILTER && !id.endsWith("-smoke") && !new RegExp(process.env.DSH_BACKEND_CASE_FILTER).test(id)) return;
  const record = { id, startedAt: new Date().toISOString() }; report.cases.push(record);
  try { await fn(record); record.passed = true; }
  catch (error) { record.passed = false; record.error = redact(error.stack ?? String(error)); await page.screenshot({ path: join(artifacts, `${id}-failure.png`) }).catch(() => {}); }
  await save(); console.log(JSON.stringify({ id, passed: record.passed, error: record.error?.split('\n')[0] }));
}
async function save() { await writeFile(join(artifacts, 'results.json'), JSON.stringify(report, null, 2)); }
function sh(command, args, cwd, environment = process.env) { return execFileSync(command, args, { cwd, env: environment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 }); }
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function redact(text) { return text.replace(/token=[^\s]+/g, 'token=[REDACTED]'); }
async function bounded(promise, timeoutMs, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
async function until(predicate, timeoutMs) { const end = Date.now() + timeoutMs; while (!await predicate()) { if (Date.now() > end) throw new Error(`Acceptance timed out after ${timeoutMs}ms`); await new Promise(done => setTimeout(done, 200)); } }
