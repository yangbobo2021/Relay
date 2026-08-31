import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Only synthetic Sessions owned by the acceptance driver are read or modified.
export async function runExtendedBackendCases(api) {
  const { session, nonce, tasks, runCase, turn, rpc, events, binding, openSession, follow,
    getPage, artifacts, run, boot, stopHost } = api;
  const prefix = session.backend;
  const restore = async () => { await openSession(session); await follow(session); };
  let imageRef;
  if (tasks.includes('images')) await runCase(`${prefix}-image-storage-restart`, async record => {
    const sharp = (await import('sharp')).default;
    const code = `IMG${randomUUID().slice(0, 6).toUpperCase()}`;
    const svg = `<svg width="640" height="220" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="220" fill="white"/><text x="40" y="140" font-family="Arial" font-size="72" fill="black">${code}</text></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    await writeFile(join(artifacts, `${prefix}-synthetic-input.png`), png);
    const prompt = 'Read the alphanumeric code printed in the attached image. Reply with only that code. Do not use tools or read files.';
    record.result = await turn(session, prompt, { content: [{ type: 'text', text: prompt }, { type: 'image', mediaType: 'image/png', data: png.toString('base64'), name: 'acceptance.png' }] });
    await runCase(`${prefix}-image-recognition`, async check => {
      check.observedReply = record.result.text;
      assert.ok(record.result.text.includes(code), 'model must read code known only through image input');
      assert.equal(record.result.activityCount, 0);
    });
    const blocks = (await events(session)).filter(e => e.type === 'user/message').flatMap(e => e.data.content ?? e.data.message?.content ?? []);
    imageRef = blocks.findLast(b => b.type === 'image')?.attachment;
    assert.ok(imageRef?.attachmentId, 'image persisted as attachment reference');
    const first = await rpc('session/attachment', { sessionId: session.sessionId, attachmentId: imageRef.attachmentId });
    record.storedSha256 = hash(Buffer.from(first.data, 'base64'));
    await decodedImage(getPage());
    await getPage().screenshot({ path: join(artifacts, `${prefix}-image-input.png`) });
    await stopHost(); await boot(); await restore();
    const restored = await rpc('session/attachment', { sessionId: session.sessionId, attachmentId: imageRef.attachmentId });
    assert.equal(hash(Buffer.from(restored.data, 'base64')), record.storedSha256);
    await decodedImage(getPage());
    record.imageAfterRestart = true;
    record.dimensions = [restored.attachment.width, restored.attachment.height];
    assert.deepEqual(record.dimensions, [640, 220]);
  });
  if (tasks.includes('fork')) await runCase(`${prefix}-fork-isolation`, async record => {
    const sourceBinding = await binding(session);
    const sourceMessages = messages(await events(session));
    const { sessionId } = await rpc('session/fork', { sessionId: session.sessionId });
    const child = { ...session, sessionId, title: `${prefix} synthetic fork` };
    await rpc('session/rename', { sessionId, title: child.title });
    try {
      await openSession(child); await follow(child);
      assert.deepEqual(messages(await events(child)), sourceMessages, 'fork starts with the completed original history');
      record.result = await turn(child, 'What synthetic MEM_ marker was remembered in the original conversation? Reply with only that marker; do not use tools.');
      assert.ok(record.result.text.includes(nonce));
      record.newBindingDistinct = (await binding(child)) !== sourceBinding;
      assert.equal(record.newBindingDistinct, true, 'fork must own a distinct backend binding');
      const secret = `CHILD_${randomUUID().slice(0, 8)}`;
      await turn(child, `Remember ${secret} only in this child conversation. Reply CHILD_READY. Do not use tools.`);
      if (imageRef) {
        const inherited = await rpc('session/attachment', { sessionId, attachmentId: imageRef.attachmentId });
        assert.equal(inherited.attachment.attachmentId, imageRef.attachmentId);
        record.inheritedAttachmentReadable = true;
      }
      await restore();
      assert.deepEqual(messages(await events(session)), sourceMessages, 'child turns do not append to parent history');
      const parent = await turn(session, 'Was a CHILD_ marker provided to this original conversation? If none, reply exactly PARENT_ISOLATED. Do not use tools.');
      assert.ok(parent.text.includes('PARENT_ISOLATED'));
      assert.ok(!parent.text.includes(secret));
      assert.equal(await binding(session), sourceBinding);
      record.parentUnaffected = true;
    } finally { await restore(); }
  });
  if (tasks.includes('isolation')) await runCase(`${prefix}-workspace-isolation`, async record => {
    const otherPath = join(run, `${prefix}-isolated-workspace`); await mkdir(otherPath);
    const { workspace } = await rpc('workspace/create', { path: otherPath });
    const { sessionId } = await rpc('session/create', { workspaceId: workspace.workspaceId, agentPreset: `relay-${prefix}` });
    const other = { ...session, sessionId, workspace: otherPath, title: `${prefix} isolated workspace` };
    await rpc('session/rename', { sessionId, title: other.title });
    await rpc('session/selectModel', { sessionId, provider: `relay-${prefix}`, model: session.model, reasoningEffort: 'low' });
    try {
      await follow(other);
      record.result = await turn(other, 'No marker has been provided in this new conversation. Reply exactly NEW_ISOLATED. Do not use tools.');
      assert.equal(record.result.text.trim(), 'NEW_ISOLATED');
      await openSession(other); await follow(other);
      assert.ok(!JSON.stringify(messages(await events(other))).includes(nonce));
      assert.notEqual(await binding(other), await binding(session));
      if (imageRef) {
        let rejected = false;
        try { await rpc('session/attachment', { sessionId, attachmentId: imageRef.attachmentId }); } catch (error) {
          rejected = String(error).includes('session/attachment-invalid');
        }
        assert.equal(rejected, true, 'unrelated Session must not retrieve the original attachment');
        record.crossSessionAttachmentDenied = true;
      }
      for (let n = 0; n < 3; n++) {
        await restore(); assert.equal(await getPage().getByText('NEW_ISOLATED', { exact: true }).count(), 0);
        await openSession(other); await follow(other);
        assert.equal(await getPage().getByText(`READY_${prefix.toUpperCase()}`, { exact: true }).count(), 0);
      }
      record.switchesIsolated = true;
    } finally { await restore(); }
  });
  if (tasks.includes('import')) await runCase(prefix === 'claude' ? 'claude-sdk-sources-excluded' : `${prefix}-selective-import`, async record => {
    const seeds = await createNativeSeeds(api);
    record.nativeSeedsCreated = seeds.length;
    const route = `/api/relay/${prefix}/import`;
    const request = async body => {
      const response = await api.getContext().request.post(api.getBase() + route, { data: body });
      assert.equal(response.status(), 200);
      return response;
    };
    const scan = await (await request({ action: 'scan', cwd: session.workspace })).json();
    record.scan = { summary: scan.summary, offeredIds: scan.candidates.map(c => c.id), seedIds: seeds.map(s => s.id) };
    if (prefix === 'claude') {
      // The existing import contract intentionally excludes SDK/headless sessions.
      assert.ok(seeds.every(seed => !scan.candidates.some(c => c.id === seed.id)), 'programmatic Claude sessions must not be offered as terminal history');
      record.programmaticSourcesExcluded = true;
      return;
    }
    assert.ok(seeds.every(seed => scan.candidates.some(c => c.id === seed.id)), 'both native seeds are offered');
    const canonicalWorkspace = await realpath(scan.workspace.path);
    for (const candidate of scan.candidates) assert.equal(await realpath(candidate.cwd), canonicalWorkspace);
    const page = getPage();
    const label = prefix === 'codex' ? 'Codex' : 'Claude';
    const open = async () => {
      await page.locator('[data-session-import-hub]').click();
      await page.getByRole('menuitem', { name: `Import from ${label}`, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: `Import ${label} Sessions`, exact: true });
      await dialog.getByRole('combobox', { name: 'Target Workspace' }).selectOption(session.workspaceId);
      await dialog.getByRole('button', { name: 'Scan sessions', exact: true }).click();
      await dialog.getByRole('checkbox').first().waitFor({ timeout: 30000 });
      return dialog;
    };
    try {
      let dialog = await open();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(Object.values(await links(api)).some(value => nativeId(value) === seeds[0].id), false);
      record.cancelBeforeImportNoBinding = true;
      dialog = await open();
      await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
      await dialog.getByRole('checkbox', { name: new RegExp(seeds[0].marker) }).check();
      assert.equal(await dialog.getByRole('checkbox', { checked: true }).count(), 1);
      const responsePromise = page.waitForResponse(response => response.url().endsWith(route)
        && response.request().postDataJSON()?.action === 'import');
      await dialog.getByRole('button', { name: 'Import selected', exact: true }).click();
      const response = await responsePromise;
      const rows = (await response.text()).trim().split('\n').map(row => JSON.parse(row));
      const result = rows.find(row => row.type === 'complete')?.result;
      assert.ok(result, JSON.stringify(rows));
      assert.equal(result.imported, 1); assert.equal(result.failed, 0);
      assert.ok(rows.some(row => row.type === 'progress'));
      const stored = await links(api);
      const entry = Object.entries(stored).find(([, value]) => nativeId(value) === seeds[0].id);
      assert.ok(entry, 'selected native session has DSH binding');
      assert.equal(Object.values(stored).some(value => nativeId(value) === seeds[1].id), false, 'unselected native session not imported');
      record.selectionAndProgress = true;
      await page.screenshot({ path: join(artifacts, `${prefix}-selective-import.png`) });
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      const selectedKey = prefix === 'codex' ? 'threadIds' : 'sessionIds';
      await runCase(`${prefix}-repeat-import`, async check => {
        const duplicate = await request({ action: 'import', cwd: session.workspace, [selectedKey]: [seeds[0].id] });
        const duplicateRows = (await duplicate.text()).trim().split('\n').map(row => JSON.parse(row));
        check.protocolRows = duplicateRows;
        assert.equal(Object.keys(await links(api)).length, Object.keys(stored).length);
        check.noDuplicateBinding = true;
        assert.ok(duplicateRows.some(row => (row.type === 'complete' && row.result?.existing === 1) || (row.type === 'error' && /already bound to DSH/.test(row.message))), 'repeat import is rejected or reported as existing');
      });
      const imported = { ...session, sessionId: entry[0], title: `${prefix} imported synthetic native session` };
      await rpc('session/rename', { sessionId: imported.sessionId, title: imported.title });
      await openSession(imported); await follow(imported);
      assert.ok(JSON.stringify(messages(await events(imported))).includes(seeds[0].marker));
      record.result = await turn(imported, 'What NATIVE_ marker was remembered before this session was imported? Reply only that marker. Do not use tools.');
      assert.ok(record.result.text.includes(seeds[0].marker));
      assert.equal(await binding(imported), seeds[0].id);
      record.resumeUsesOriginalNativeBinding = true;
    } finally {
      const dialog = getPage().getByRole('dialog');
      if (await dialog.count()) await getPage().keyboard.press('Escape').catch(() => {});
      await restore();
    }
  });
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const messages = es => es.filter(e => ['user/message', 'assistant/message'].includes(e.type)).map(e => ({ type: e.type, data: e.data }));
async function decodedImage(page) {
  await page.waitForFunction(() => [...document.images].some(img => img.complete && img.naturalWidth === 640 && img.naturalHeight === 220), null, { timeout: 15000 });
}

const nativeId = value => value.threadId ?? value.claudeSessionId ?? value.sessionId;
async function links(api) { return JSON.parse(await readFile(join(api.run, `${api.session.backend}-links.json`), 'utf8')).sessions ?? {}; }
async function createNativeSeeds(api) {
  const { session } = api;
  const seeds = ['A', 'B'].map(letter => ({ marker: `NATIVE_${letter}_${randomUUID().slice(0, 8)}` }));
  if (session.backend === 'codex') {
    const { CodexAppServerClient } = await import('../../integrations/codex/app-server-client.mjs');
    const { CodexSessionRuntime } = await import('../../integrations/codex/session-runtime.mjs');
    const runtime = new CodexSessionRuntime({ client: new CodexAppServerClient(), cwd: session.workspace });
    runtime.on('serverRequest', request => runtime.rejectRequest(request.id, new Error('Native import fixture must not request tools or approvals')));
    try {
      await runtime.initialize();
      for (const seed of seeds) {
        const created = await runtime.createSession({ cwd: session.workspace, model: session.model, effort: 'low', sandbox: 'read-only', approvalPolicy: 'on-request' });
        seed.id = created.id;
        const turn = await runtime.sendMessage(seed.id, { text: `Remember ${seed.marker}. Reply SEED_READY. Do not call tools.` });
        const deadline = Date.now() + 120000;
        while (runtime.sessions.get(seed.id)?.turns.find(t => t.id === turn.id)?.status === 'inProgress') {
          assert.ok(Date.now() < deadline, 'native seed turn timeout');
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        const completed = runtime.sessions.get(seed.id)?.turns.find(t => t.id === turn.id);
        assert.equal(completed?.status, 'completed', JSON.stringify(completed?.error));
      }
    } finally { await runtime.close(); }
  } else {
    const require = createRequire(join(api.home, 'profiles/web/node_modules/relay-dsh-plugin-claude/package.json'));
    const { query } = await import(pathToFileURL(require.resolve('@anthropic-ai/claude-agent-sdk')).href);
    for (const seed of seeds) {
      const stream = query({ prompt: `Remember ${seed.marker}. Reply SEED_READY. Do not call tools.`, options: {
        cwd: session.workspace, model: 'sonnet', maxTurns: 1, tools: [], permissionMode: 'default', settingSources: ['user', 'project'],
      } });
      let result;
      try { for await (const message of stream) { if (message.session_id) seed.id = message.session_id; if (message.type === 'result') result = message; } }
      finally { stream.close(); }
      assert.equal(result?.is_error, false, 'native Claude seed must complete');
      assert.ok(seed.id);
    }
  }
  return seeds;
}
