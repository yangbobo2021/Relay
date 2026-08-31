import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export async function runEventsCases(api) {
  const { session, runCase, rpc, turn, events, binding, openSession, follow, getPage, boot, stopHost, artifacts } = api;
  const list = () => rpc('relayManagement/list', {}, true);
  const restore = async () => { await openSession(session); await follow(session); };
  await runCase('events-real-tool-overdue-restart', async record => {
    const marker = `TIMER_WOKEN_${randomUUID().slice(0, 8)}`;
    const originalBinding = await binding(session);
    record.schedule = await turn(session, `Use the DSH relay_schedule_timer tool exactly once with after_seconds 30, task_summary "Synthetic restart acceptance", resume_prompt "Reply exactly ${marker}. Do not register more waits.". Then reply TIMER_REGISTERED. When that timer event later arrives, reply exactly ${marker}. Do not use shell sleep or another scheduler.`);
    const snapshot = await list();
    const registration = snapshot.registrations.find(r => r.session_id === session.sessionId);
    assert.ok(registration?.monitors?.length, 'real Agent tool must register a durable Monitor');
    const monitor = registration.monitors.at(-1);
    const deadline = new Date(registration.context?.deadline ?? monitor.detector?.deadline).getTime();
    assert.ok(Number.isFinite(deadline)); assert.ok(deadline > Date.now(), 'stop before deadline');
    record.monitorId = monitor.monitor_id;
    await stopHost();
    const wait = Math.max(0, deadline - Date.now() + 1200); assert.ok(wait < 45000);
    await new Promise(resolve => setTimeout(resolve, wait));
    await boot(); await restore();
    await until(async () => (await events(session)).some(e => e.type === 'assistant/message'
      && e.data.message?.content?.some(b => b.type === 'text' && b.text.includes(marker))), 120000);
    const deliveries = await relayMessages(events, session);
    assert.equal(deliveries.length, 1);
    assert.equal(await binding(session), originalBinding);
    const after = (await list()).registrations.find(r => r.session_id === session.sessionId);
    assert.ok(after === undefined || !after.monitors.some(m => m.monitor_id === monitor.monitor_id && ['active', 'triggered', 'degraded'].includes(m.state)), 'completed timer is no longer active');
    record.overdueDeliveredToOriginalSession = true;
    record.deliveryCount = 1;
    await getPage().getByText(marker, { exact: true }).waitFor();
    await getPage().screenshot({ path: join(artifacts, 'events-overdue-restart.png') });
    await stopHost(); await boot(); await restore();
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.equal((await relayMessages(events, session)).length, 1);
    record.secondRestartNoDuplicate = true;
  });
  await runCase('events-management-ui-cancel', async record => {
    record.schedule = await turn(session, 'Use the DSH relay_schedule_timer tool exactly once with after_seconds 600, task_summary "Synthetic management cancellation", resume_prompt "This fixture will be cancelled." Then reply MANAGEMENT_READY. Do not use other tools.');
    const registration = (await list()).registrations.find(r => r.session_id === session.sessionId);
    assert.ok(registration?.monitors?.some(m => m.state === 'active'));
    try {
      await getPage().getByRole('button', { name: 'Settings', exact: true }).click();
      await getPage().getByText('Waiting events', { exact: true }).click();
      await getPage().getByText('Synthetic management cancellation', { exact: true }).waitFor();
      await getPage().getByRole('button', { name: 'Check now', exact: true }).click();
      await getPage().getByRole('button', { name: 'Cancel waits', exact: true }).click();
      await getPage().getByRole('button', { name: 'Confirm cancel', exact: true }).click();
      await until(async () => !(await list()).registrations.some(r => r.session_id === session.sessionId), 10000);
      record.cancelledViaUi = true;
      await getPage().screenshot({ path: join(artifacts, 'events-management-cancel.png') });
    } finally {
      // Only this test Session's synthetic timer may be cancelled by cleanup.
      await rpc('relayManagement/cancel', { sessionId: session.sessionId }, true);
      await restore();
    }
  });
}
async function relayMessages(events, session) { return (await events(session)).filter(e => e.type === 'user/message' && e.data.source?.plugin === 'relay'); }
async function until(predicate, timeout) { const end = Date.now() + timeout; while (!await predicate()) { assert.ok(Date.now() < end, 'event acceptance timeout'); await new Promise(r => setTimeout(r, 250)); } }
