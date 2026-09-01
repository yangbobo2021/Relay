import assert from 'node:assert/strict';

// Uses the public service faces supplied by a test-only plugin in an isolated
// DSH_HOME. It never submits a model prompt or reads the user's conversations.
export async function verifyClientFeatures(page, { selected, workspace }) {
  const has = name => selected.includes(`relay-dsh-plugin-${name}`);
  const required = [];
  if (has('codex')) required.push(['conversation.chat.node', 'key', 'relay-codex-process'],
    ['conversation.chat.node', 'key', 'relay-codex-activity'], ['relay.session-import.provider', 'id', 'codex']);
  if (has('claude')) required.push(['conversation.chat.node', 'key', 'relay-claude-activity'],
    ['relay.session-import.provider', 'id', 'claude']);
  if (has('manager')) required.push(['settings.plugins.tab', 'id', 'marketplace']);
  if (has('events')) required.push(['settings.section', 'id', 'relay-waits']);
  if (has('files')) required.push(['workbench.side.view', 'key', 'files']);
  if (has('terminal')) required.push(['workbench.bottom.view', 'key', 'terminal']);
  if (has('session-import') || has('codex') || has('claude')) required.push(['sidebar.footer.action', 'id', 'relay-session-import-hub']);
  await page.waitForFunction(() => Boolean(window.__RELAY_DSH_TEST__));
  await page.waitForFunction(required => required.every(([slot, field, value]) =>
    window.__RELAY_DSH_TEST__.get('slots').entries(slot).some(entry => entry.options[field] === value)), required);
  const checks = ['client registrations'];
  const notice = page.getByRole('button', { name: 'Continue', exact: true });
  if (await notice.isVisible()) await notice.click();
  if (has('workbench') || has('codex') || has('claude')) {
    const sessionId = await page.evaluate(async cwd => {
      const sessions = window.__RELAY_DSH_TEST__.get('sessions');
      const id = await sessions.create({ cwd });
      sessions.open(id);
      return id;
    }, workspace);
    checks.push('create/open session');
    if (!has('codex')) {
      const later = page.getByRole('button', { name: 'Configure later', exact: true });
      await later.waitFor({ timeout: 3000 }).catch(() => {});
      if (await later.isVisible()) await later.click();
    }
    if (has('codex')) {
      const selectedPreset = await page.evaluate(async sessionId => {
        const ctx = window.__RELAY_DSH_TEST__;
        const remote = ctx.get('remote.agentPresets');
        return remote ? remote.select(sessionId, 'relay-codex')
          : ctx.get('connection').api.agentPresets.select({ sessionId, agentPreset: 'relay-codex' });
      }, sessionId);
      assert.equal((selectedPreset.result ?? selectedPreset).ok, true, JSON.stringify(selectedPreset));
      await page.waitForFunction(async sessionId => {
        const state = await window.__RELAY_DSH_TEST__.get('modelDirectories').directoryFor(sessionId).load();
        return state.current.provider === 'relay-codex';
      }, sessionId, { timeout: 15_000 });
      checks.push('Codex preset/model synchronization');
    }
    if (has('workbench')) {
      // The public layout service must be connected to a real mounted store.
      await page.evaluate(() => window.__RELAY_DSH_TEST__.get('layout').toggleSidebar());
      await page.evaluate(() => window.__RELAY_DSH_TEST__.get('layout').toggleSidebar());
      checks.push('Workbench mounted actions');
    }
    if (has('files')) {
      await page.evaluate(() => window.__RELAY_DSH_TEST__.get('workbench').openView('side', 'files'));
      const file = page.getByRole('treeitem').filter({ hasText: 'dual-compatibility.md' });
      await file.click();
      await page.getByRole('article', { name: 'File content dual-compatibility.md' }).getByText('RELAY_DUAL_FILE').waitFor();
      await page.getByRole('button', { name: 'View source', exact: true }).click();
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
      const split = page.locator('[data-side="details"]');
      const before = await split.boundingBox();
      assert.ok(before, 'side panel splitter is visible');
      await page.mouse.move(before.x + before.width / 2, before.y + 180);
      await page.mouse.down();
      await page.mouse.move(before.x - 60, before.y + 180, { steps: 6 });
      await page.mouse.up();
      await page.waitForFunction(beforeX => Math.abs(document.querySelector('[data-side="details"]').getBoundingClientRect().x - beforeX) > 20, before.x, { timeout: 3000 }).catch(async () => { throw new Error(`side panel did not resize: ${JSON.stringify({ before, after: await split.boundingBox() })}`); });
      await page.evaluate(() => window.__RELAY_DSH_TEST__.get('workbench').closeRegion('side'));
      await page.evaluate(() => window.__RELAY_DSH_TEST__.get('workbench').openView('side', 'files'));
      await page.getByRole('article', { name: 'File content dual-compatibility.md' }).waitFor();
      checks.push('Files tree/Markdown/source, resize, close/reopen');
    }
    if (has('terminal')) {
      await page.evaluate(() => window.__RELAY_DSH_TEST__.get('workbench').openView('bottom', 'terminal'));
      if (!has('codex')) {
        const response = await page.evaluate(sessionId => window.__RELAY_DSH_TEST__.get('remote.relayWorkbenchTerminal').spawn({ sessionId }), sessionId);
        assert.equal(response.ok, true);
        assert.equal(response.value.ok, false);
        assert.equal(response.value.error.code, 'provider-unavailable');
        checks.push('Terminal reports missing provider without crashing');
        return checks;
      }
      const terminalId = await page.evaluate(async sessionId => {
        const terminal = window.__RELAY_DSH_TEST__.get('remote.relayWorkbenchTerminal');
        const unwrap = response => {
          if (!response.ok) throw new Error(JSON.stringify(response));
          if (!response.value.ok) throw new Error(JSON.stringify(response.value));
          return response.value.value;
        };
        const created = unwrap(await terminal.spawn({ sessionId, name: 'Dual compatibility' }));
        unwrap(await terminal.resize({ sessionId, terminalId: created.sessionId, cols: 100, rows: 28 }));
        unwrap(await terminal.input({ sessionId, terminalId: created.sessionId, data: "printf 'RELAY_%s_TERMINAL\\n' DUAL\n" }));
        return created.sessionId;
      }, sessionId);
      try {
        await page.waitForFunction(async ({ sessionId, terminalId }) => {
          const response = await window.__RELAY_DSH_TEST__.get('remote.relayWorkbenchTerminal').readRaw({ sessionId, terminalId });
          return response.ok && response.value.ok && response.value.value.text.includes('RELAY_DUAL_TERMINAL');
        }, { sessionId, terminalId });
      } finally {
        await page.evaluate(({ sessionId, terminalId }) => window.__RELAY_DSH_TEST__.get('remote.relayWorkbenchTerminal')
          .input({ sessionId, terminalId, data: 'exit\n' }), { sessionId, terminalId });
      }
      checks.push('Terminal spawn/input/output/resize/exit');
    }
  }
  return checks;
}
