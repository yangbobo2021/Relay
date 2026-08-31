import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export async function runWorkbenchCases(api) {
  const { session, runCase, rpc, getPage, artifacts, run, openSession, follow } = api;
  const ws = session.workspace;
  await mkdir(join(ws, '目录'));
  await writeFile(join(ws, '目录', '中文.txt'), '中文内容_UNICODE_OK');
  await writeFile(join(ws, 'empty.txt'), '');
  await writeFile(join(ws, 'code.js'), 'const CODE_PREVIEW_OK = 42;\n');
  await writeFile(join(ws, 'notes.md'), '# Preview heading\n\n```js\nconst COPY_FIXTURE = 7;\n```\n\nFootnote[^a].\n\n[^a]: FOOTNOTE_FIXTURE\n');
  await writeFile(join(ws, 'large.txt'), '大'.repeat(400000));
  await writeFile(join(ws, 'binary.bin'), Buffer.from([0, 1, 2, 255]));
  const outside = join(run, 'outside-sentinel.txt'); await writeFile(outside, 'OUTSIDE_SENTINEL');
  await symlink(outside, join(ws, 'outside-link.txt'));
  await openSession(session); await follow(session); // Refresh directory inventory after creating fixtures.
  const read = path => rpc('relayWorkspaceFiles/readText', { sessionId: session.sessionId, path });
  const showFiles = async () => {
    {
      await getPage().getByRole('button', { name: 'Open panel menu' }).click();
      await getPage().getByRole('menuitem', { name: 'Files', exact: true }).click();
    }
    await getPage().getByRole('tree', { name: 'Workspace files' }).waitFor();
    await getPage().waitForTimeout(350);
  };
  const selectFile = async name => {
    await showFiles();
    await getPage().getByRole('textbox', { name: 'Filter files' }).fill(name);
    await getPage().getByRole('treeitem', { name, exact: true }).click();
  };
  await runCase('files-text-boundaries', async record => {
    const unicode = await read('目录/中文.txt'); assert.equal(unicode.value?.content, '中文内容_UNICODE_OK');
    assert.equal((await read('empty.txt')).value?.content, '');
    const large = await read('large.txt'); assert.equal(large.value?.truncated, true);
    assert.ok(!large.value.content.includes('\uFFFD'));
    assert.equal((await read('binary.bin')).error?.code, 'not-text');
    assert.equal((await read('missing.txt')).error?.code, 'not-found');
    assert.equal((await read('目录')).error?.code, 'not-a-file');
    record.largePreviewBytes = Buffer.byteLength(large.value.content);
  });
  for (const [id, path] of [['files-parent-traversal', '../outside-sentinel.txt'], ['files-symlink-boundary', 'outside-link.txt']]) {
    await runCase(id, async record => {
      const result = await read(path); record.result = result.ok ? { ok: true, leakedSentinel: result.value.content.includes('OUTSIDE_SENTINEL') } : result;
      assert.equal(result.ok, false, 'outside content must not be readable');
      assert.ok(!JSON.stringify(result).includes('OUTSIDE_SENTINEL'));
    });
  }
  await runCase('files-markdown-code-ui', async record => {
    await selectFile('code.js'); await getPage().getByRole('article').filter({ hasText: 'CODE_PREVIEW_OK' }).waitFor();
    await selectFile('notes.md');
    const article = getPage().getByRole('article', { name: 'File content notes.md' });
    await article.getByRole('heading', { name: 'Preview heading' }).waitFor();
    await article.getByText('FOOTNOTE_FIXTURE', { exact: false }).waitFor();
    await api.getContext().grantPermissions(['clipboard-read', 'clipboard-write']);
    await article.getByRole('button', { name: 'Copy', exact: true }).click();
    assert.ok((await getPage().evaluate(() => navigator.clipboard.readText())).includes('COPY_FIXTURE'));
    await getPage().getByRole('button', { name: 'View source', exact: true }).click();
    assert.ok((await article.innerText()).includes('# Preview heading'));
    await getPage().getByRole('button', { name: 'Preview', exact: true }).click();
    await article.getByRole('heading', { name: 'Preview heading' }).waitFor();
    await getPage().getByRole('button', { name: 'Hide file tree' }).click();
    await getPage().getByRole('button', { name: 'Show file tree' }).click();
    record.copySourceAndTreeToggle = true;
    await getPage().screenshot({ path: join(artifacts, 'files-markdown-code-ui.png') });
  });
  await runCase('workbench-resize', async record => {
    await showFiles();
    const region = getPage().getByRole('region', { name: 'Auxiliary workspace' });
    const before = await region.boundingBox();
    const handle = getPage().locator('[data-side="details"]'); const box = await handle.boundingBox();
    assert.ok(box);
    await getPage().mouse.move(box.x + box.width / 2, box.y + box.height / 2); await getPage().mouse.down();
    await getPage().mouse.move(box.x + 100, box.y + box.height / 2, { steps: 12 }); await getPage().mouse.up();
    await getPage().waitForTimeout(350);
    const after = await region.boundingBox(); record.widthsBeforeReload = [before.width, after.width]; assert.ok(Math.abs(after.width - before.width) > 40);
    record.widths = [before.width, after.width];
    await runCase('workbench-refresh-preference', async check => {
      await getPage().reload({ waitUntil: 'domcontentloaded' }); await follow(session); await showFiles();
      const restored = await region.boundingBox(); check.widths = [after.width, restored.width];
      assert.ok(Math.abs(restored.width - after.width) <= 2, 'resized preference survives refresh and reopening');
    });
    await getPage().getByRole('button', { name: 'Close side panel' }).click();
    await getPage().setViewportSize({ width: 640, height: 720 });
    const width = await getPage().evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(width.document <= width.viewport + 1, JSON.stringify(width));
    await getPage().setViewportSize({ width: 1440, height: 960 });
    await showFiles(); record.narrowViewportNoOverflow = true;
  });
  await runCase('files-workspace-switch', async record => {
    const otherPath = join(run, 'files-second-workspace'); await mkdir(otherPath); await writeFile(join(otherPath, 'code.js'), 'SECOND_WORKSPACE_ONLY');
    const { workspace } = await rpc('workspace/create', { path: otherPath });
    const { sessionId } = await rpc('session/create', { workspaceId: workspace.workspaceId, agentPreset: `relay-${session.backend}` });
    const other = { ...session, sessionId, workspace: otherPath, title: 'Files second workspace' };
    await rpc('session/rename', { sessionId, title: other.title });
    await rpc('session/selectModel', { sessionId, provider: `relay-${session.backend}`, model: session.model, reasoningEffort: 'low' });
    await follow(other); await api.turn(other, 'Reply FILES_SECOND_READY. Do not use tools.');
    try {
      await openSession(other); await follow(other); await selectFile('code.js');
      const article = getPage().getByRole('article', { name: 'File content code.js' });
      assert.ok((await article.innerText()).includes('SECOND_WORKSPACE_ONLY')); assert.ok(!(await article.innerText()).includes('CODE_PREVIEW_OK'));
      record.distinctWorkspaceContent = true;
    } finally { await openSession(session); await follow(session); }
  });
  await runCase('terminal-multiple-and-host-cleanup', async record => {
    await openSession(session); await follow(session);
    await getPage().getByRole('button', { name: 'Open panel menu' }).click();
    await getPage().getByRole('menuitem', { name: 'Terminal', exact: true }).click();
    const region = getPage().getByRole('region', { name: 'Terminal', exact: true });
    const send = async text => { await region.locator('.xterm-helper-textarea').focus(); await getPage().keyboard.insertText(text); await getPage().keyboard.press('Enter'); };
    const waitFile = async name => { const until = Date.now() + 15000; while (!existsSync(join(ws, name))) { assert.ok(Date.now() < until, name); await new Promise(r => setTimeout(r, 100)); } return Number((await readFile(join(ws, name), 'utf8')).trim()); };
    await getPage().waitForFunction(() => document.querySelector('[aria-label="Terminal canvas"]')?.getAttribute('aria-busy') === 'false');
    await send('printf "%s" "$$" > terminal-one.pid'); const first = await waitFile('terminal-one.pid');
    await getPage().getByRole('button', { name: 'New terminal' }).click();
    await getPage().waitForFunction(() => document.querySelector('[aria-label="Terminal canvas"]')?.getAttribute('aria-busy') === 'false');
    await send('printf "%s" "$$" > terminal-two.pid'); const second = await waitFile('terminal-two.pid');
    assert.notEqual(first, second); assert.ok(first > 0 && second > 0);
    await api.stopHost();
    const until = Date.now() + 10000; while ([first, second].some(alive)) { assert.ok(Date.now() < until, 'all owned shells stop with host'); await new Promise(r => setTimeout(r, 100)); }
    record.distinctShellsAndHostCleanup = true;
    await api.boot(); await openSession(session); await follow(session);
  });
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; throw e; } }
