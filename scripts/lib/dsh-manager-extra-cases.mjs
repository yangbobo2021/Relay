import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Mutations are limited to Files in this driver's disposable Profile.
export async function runManagerCases(api) {
  const { session, runCase, turn, getPage, openSession, follow, home, artifacts } = api;
  const target = 'relay-dsh-plugin-files';
  const statePath = join(home, 'profiles/web/.relay-plugin-manager/state.json');
  const disabled = async () => {
    try { return Boolean(JSON.parse(await readFile(statePath, 'utf8')).disabled[target]?.length); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  };
  const patch = () => readFile(join(home, 'profiles/web/cordis.patch.yml'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''; throw error;
  });
  for (const [operation, allow] of [['disable', false], ['disable', true], ['enable', true]]) {
    await runCase(`manager-conversation-${operation}-${allow ? 'approve' : 'decline'}`, async record => {
      await openSession(session); await follow(session);
      const before = await patch();
      let answered = false;
      record.result = await turn(session, `This is an acceptance test in a disposable DSH Profile. Use plugin_manage action=plan operation=${operation} target=${target}, then plugin_manage action=confirm with that plan's confirmationToken. Wait for the real DSH plan-review UI answer. Do not call generic request_user_input or ask_user_question. Do not execute before confirmation. If declined, reply MANAGER_DECLINED and stop. If approved, poll plugin_manage action=status for the returned operationId until terminal state, then report that state and reply MANAGER_DONE. Do not modify any other plugin, use shell tools, or restart DSH.`, {
        during: async () => {
          const card = getPage().locator('[data-plan-review-key]').first();
          if (answered || !await card.isVisible()) return;
          const text = await card.innerText();
          assert.ok(text.includes(target), 'review identifies exact package');
          assert.ok(text.toLowerCase().includes(operation), 'review identifies operation');
          assert.equal(await patch(), before, 'Profile unchanged before UI approval');
          record.unchangedBeforeAnswer = true;
          await getPage().screenshot({ path: join(artifacts, `${record.id}.png`) });
          await card.getByRole('button', { name: allow ? 'Approve' : 'Refuse', exact: true }).click();
          answered = true;
        },
      });
      assert.ok(answered, 'real manager plan-review UI must be answered');
      if (allow) {
        assert.equal(await disabled(), operation === 'disable');
        assert.ok(record.result.text.includes('MANAGER_DONE'));
      } else {
        assert.equal(await patch(), before);
        assert.equal(await disabled(), false);
        assert.ok(record.result.text.includes('MANAGER_DECLINED'));
      }
      record.confirmedProfileState = true;
    });
  }
  await runCase('manager-recommended-plugins-ui', async record => {
    await openSession(session); await follow(session);
    await getPage().getByRole('button', { name: 'Settings', exact: true }).click();
    await getPage().getByText('Plugins', { exact: true }).click();
    await getPage().getByText('Recommended plugins', { exact: true }).click();
    for (const name of ['relay-dsh-plugin-codex', 'relay-dsh-plugin-claude']) {
      await getPage().getByRole('heading', { name, exact: true }).waitFor();
    }
    record.twoBackendRecommendationsVisible = true;
    await getPage().screenshot({ path: join(artifacts, 'manager-recommendations.png') });
    await openSession(session); await follow(session);
  });
}
