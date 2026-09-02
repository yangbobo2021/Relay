import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import { GmailConnector, createGmailPushHandler, resolveEmailBinding } from "../src/connector.mjs";
import { EmailCursorStore } from "../src/cursor-store.mjs";
import { GmailApiClient } from "../src/gmail-api.mjs";

test("EP15-001/004: first push establishes cursor; next push commits only after all Events handling", async t => {
  const store = await cursorStore(t);
  const order = [];
  const events = [];
  const connector = new GmailConnector({
    cursorStore: store,
    relayEvents: {
      listWaits: () => [],
      async handleEvent() { throw new Error("trusted source path required"); },
    },
    boundSource: { async handleEvent({ event, binding }) {
      assert.equal(binding, null);
      order.push(`event:${event.provider_message_id}`);
      events.push(event);
      return result(event.provider_message_id);
    } },
    client: {
      async listHistory({ cursor }) { assert.equal(cursor, "100"); return { cursor: "102", messageIds: ["m1", "m2"] }; },
      async getMessage({ messageId }) { return gmailMessage(messageId); },
    },
  });
  const initialized = await connector.sync({ account: "agent@example.test", notifiedCursor: "100" });
  assert.equal(initialized.initialized, true);
  assert.equal(store.get("agent@example.test").cursor, "100");
  const synced = await connector.sync({ account: "agent@example.test", notifiedCursor: "102" });
  assert.deepEqual(order, ["event:m1", "event:m2"]);
  assert.equal(synced.events.length, 2);
  assert.equal(store.get("agent@example.test").cursor, "102");
});

test("EP15-003/004: partial Event failure leaves cursor at the safe checkpoint", async t => {
  const store = await cursorStore(t);
  store.commit("agent@example.test", "200");
  let calls = 0;
  const connector = new GmailConnector({
    cursorStore: store,
    relayEvents: {
      listWaits: () => [],
      async handleEvent() { throw new Error("trusted source path required"); },
    },
    boundSource: { async handleEvent({ event }) {
      calls += 1;
      if (event.provider_message_id === "m2") throw new Error("storage unavailable");
      return result(event.provider_message_id);
    } },
    client: {
      async listHistory() { return { cursor: "202", messageIds: ["m1", "m2"] }; },
      async getMessage({ messageId }) { return gmailMessage(messageId); },
    },
  });
  await assert.rejects(connector.sync({ account: "agent@example.test", notifiedCursor: "202" }), /storage unavailable/);
  assert.equal(calls, 2);
  assert.equal(store.get("agent@example.test").cursor, "200");
});

test("EP15-004: expired cursor performs a bounded resync and advances only after every Event", async t => {
  const store = await cursorStore(t);
  store.commit("agent@example.test", "400");
  const handled = [];
  const connector = new GmailConnector({
    cursorStore: store,
    relayEvents: { listWaits: () => [] },
    boundSource: { async handleEvent({ event }) { handled.push(event.provider_message_id); return result(event.provider_message_id); } },
    client: {
      async listHistory() { throw Object.assign(new Error("expired"), { errorClass: "cursor_expired" }); },
      async listRecentMessageIds({ maxMessages }) { assert.equal(maxMessages, 500); return { messageIds: ["m1", "m2"], truncated: false }; },
      async getMessage({ messageId }) { return gmailMessage(messageId); },
    },
  });
  const synced = await connector.sync({ account: "agent@example.test", notifiedCursor: "450" });
  assert.equal(synced.resynced, true);
  assert.deepEqual(handled, ["m1", "m2"]);
  assert.equal(store.get("agent@example.test").cursor, "450");
  assert.equal(store.get("agent@example.test").status, "healthy");
});

test("EP15-004: failed or oversized resync stays degraded at the old checkpoint", async t => {
  for (const mode of ["event-failure", "too-large"]) {
    const store = await cursorStore(t);
    const account = `${mode}@example.test`;
    store.commit(account, "500");
    const connector = new GmailConnector({
      cursorStore: store,
      relayEvents: { listWaits: () => [] },
      boundSource: { async handleEvent() { throw new Error("Event persistence failed"); } },
      client: {
        async listHistory() { throw Object.assign(new Error("expired"), { errorClass: "cursor_expired" }); },
        async listRecentMessageIds() { return mode === "too-large" ? { messageIds: [], truncated: true } : { messageIds: ["m1"], truncated: false }; },
        async getMessage({ messageId }) { return gmailMessage(messageId); },
      },
    });
    await assert.rejects(connector.sync({ account, notifiedCursor: "550" }), mode === "too-large" ? /exceeded 500/ : /persistence failed/);
    assert.equal(store.get(account).cursor, "500");
    assert.equal(store.get(account).status, "degraded");
    assert.equal(store.get(account).last_error_class, "cursor_expired");
  }
});

test("EP15-004: partial-page rate failure preserves checkpoint and restart resumes without message loss", async t => {
  const directory = await mkdtemp(join(tmpdir(), "relay-email-page-restart-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "email.sqlite");
  let store = new EmailCursorStore(path);
  store.commit("agent@example.test", "600");
  const failed = new GmailConnector({
    cursorStore: store,
    relayEvents: { listWaits: () => [] },
    boundSource: { async handleEvent() { throw new Error("must not persist a partial history page"); } },
    client: { async listHistory() { throw Object.assign(new Error("rate limited after page one"), { errorClass: "rate_limited" }); } },
  });
  await assert.rejects(failed.sync({ account: "agent@example.test", notifiedCursor: "603" }),
    error => error.errorClass === "rate_limited");
  assert.equal(store.get("agent@example.test").cursor, "600");
  store.close();

  store = new EmailCursorStore(path);
  const handled = [];
  const resumed = new GmailConnector({
    cursorStore: store,
    relayEvents: { listWaits: () => [] },
    boundSource: { async handleEvent({ event }) { handled.push(event.provider_message_id); return result(event.provider_message_id); } },
    client: {
      async listHistory({ cursor }) { assert.equal(cursor, "600"); return { cursor: "603", messageIds: ["m601", "m602", "m603"] }; },
      async getMessage({ messageId }) { return gmailMessage(messageId); },
    },
  });
  await resumed.sync({ account: "agent@example.test", notifiedCursor: "603" });
  assert.deepEqual(handled, ["m601", "m602", "m603"]);
  assert.equal(store.get("agent@example.test").cursor, "603");
  store.close();
});

test("EP15-003: concurrent push and poll overlap converges by provider message identity", async t => {
  const store = await cursorStore(t);
  store.commit("agent@example.test", "700");
  const persisted = new Set();
  let providerCalls = 0;
  const connector = new GmailConnector({
    cursorStore: store,
    relayEvents: { listWaits: () => [] },
    boundSource: { async handleEvent({ event }) {
      const duplicate = persisted.has(event.source_event_id);
      persisted.add(event.source_event_id);
      return { duplicate, event: { event_id: event.source_event_id, state: "resolved" } };
    } },
    client: {
      async listHistory() {
        providerCalls += 1;
        await new Promise(resolve => setImmediate(resolve));
        return { cursor: "702", messageIds: ["overlap-1", "overlap-2"] };
      },
      async getMessage({ messageId }) { return gmailMessage(messageId); },
    },
  });
  await Promise.all([
    connector.sync({ account: "agent@example.test", notifiedCursor: "702" }),
    connector.sync({ account: "agent@example.test", notifiedCursor: "702" }),
  ]);
  assert.equal(providerCalls, 2, "the test must actually overlap two provider reads");
  assert.deepEqual([...persisted].sort(), ["overlap-1", "overlap-2"]);
  assert.equal(store.get("agent@example.test").cursor, "702");
});

test("EP15-006: exactly one email_thread artifact binds; ambiguity never picks the first", () => {
  const one = registration("s1", "w1");
  assert.deepEqual(resolveEmailBinding([one], "gmail:a@b.test:t1"), {
    session_id: "s1", wait_id: "w1", wait_version: 0, source_subject: "gmail:a@b.test:t1",
  });
  assert.equal(resolveEmailBinding([one, registration("s2", "w2")], "gmail:a@b.test:t1"), null);
});

test("EP15-001/008: authenticated push acknowledges only after sync and rejects wrong tokens", async () => {
  let calls = 0;
  const handler = createGmailPushHandler({
    pushToken: "0123456789abcdef",
    connector: { async sync(input) { calls += 1; assert.equal(input.account, "agent@example.test"); return { initialized: false, cursor: { cursor: "301" }, events: [result("m1")] }; } },
  });
  const denied = responseRecorder();
  await handler(pushRequest({ authorization: "Bearer wrong" }), denied);
  assert.equal(denied.status, 401);
  assert.equal(calls, 0);
  const accepted = responseRecorder();
  await handler(pushRequest(), accepted);
  assert.equal(accepted.status, 202);
  assert.equal(accepted.json.event_count, 1);
  assert.equal(calls, 1);
});

test("EP11-001/EP15-007: Gmail push and API credentials rotate and revoke without caching", async () => {
  let pushToken = "push-token-0123456789-old";
  let apiToken = "api-token-0123456789-old";
  let syncCalls = 0;
  const handler = createGmailPushHandler({
    pushToken: async () => pushToken,
    connector: { async sync() { syncCalls += 1; return { initialized: false, cursor: { cursor: "1" }, events: [] }; } },
  });
  const first = responseRecorder();
  await handler(pushRequest({ authorization: `Bearer ${pushToken}` }), first);
  assert.equal(first.status, 202);
  const oldPush = pushToken;
  pushToken = "push-token-0123456789-new";
  const deniedOld = responseRecorder();
  await handler(pushRequest({ authorization: `Bearer ${oldPush}` }), deniedOld);
  assert.equal(deniedOld.status, 401);
  const acceptedNew = responseRecorder();
  await handler(pushRequest({ authorization: `Bearer ${pushToken}` }), acceptedNew);
  assert.equal(acceptedNew.status, 202);

  const authorizations = [];
  const client = new GmailApiClient({
    getToken: async () => apiToken,
    fetchImpl: async (_url, request) => { authorizations.push(request.headers.authorization); return { ok: true, status: 200, async json() { return { historyId: "1" }; } }; },
  });
  await client.listHistory({ cursor: "1" });
  apiToken = "api-token-0123456789-new";
  await client.listHistory({ cursor: "1" });
  assert.deepEqual(authorizations, ["Bearer api-token-0123456789-old", "Bearer api-token-0123456789-new"]);

  pushToken = null;
  const revoked = responseRecorder();
  await handler(pushRequest({ authorization: "Bearer push-token-0123456789-new" }), revoked);
  assert.equal(revoked.status, 503);
  assert.equal(revoked.json.error, "email_sync_failed");
  assert.equal(syncCalls, 2);
  assert.doesNotMatch(JSON.stringify([first.json, deniedOld.json, revoked.json]), /push-token|api-token/u);
});

test("EP15-007: mailbox pause, resume, disconnect, and restart are durable and enforced", async t => {
  const directory = await mkdtemp(join(tmpdir(), "relay-email-lifecycle-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "email.sqlite");
  let store = new EmailCursorStore(path);
  store.commit("agent@example.test", "900");
  assert.equal(store.pause("agent@example.test").status, "paused");
  store.close();

  store = new EmailCursorStore(path);
  t.after(() => store.close());
  assert.equal(store.get("agent@example.test").status, "paused", "pause survives restart");
  const connector = new GmailConnector({
    cursorStore: store,
    relayEvents: { listWaits: () => [] },
    boundSource: { async handleEvent() { throw new Error("must not run while paused"); } },
    client: { async listHistory() { throw new Error("must not call provider while paused"); } },
  });
  await assert.rejects(connector.sync({ account: "agent@example.test", notifiedCursor: "901" }), error => error.errorClass === "connector_paused");
  assert.equal(store.resume("agent@example.test").status, "healthy");
  store.disconnect("agent@example.test");
  assert.equal(store.get("agent@example.test"), null);
  assert.throws(() => store.pause("missing@example.test"), /not connected/);
});

test("EP15-004/008: Gmail provider errors are stable and token-redacted", async () => {
  const token = "SECRET-GMAIL-TOKEN";
  for (const [status, errorClass] of [[400, "cursor_invalid"], [401, "authentication"], [403, "permission"], [404, "cursor_expired"], [429, "rate_limited"], [503, "provider_unavailable"]]) {
    const client = new GmailApiClient({ token, fetchImpl: async (_url, request) => {
      assert.equal(request.headers.authorization, `Bearer ${token}`);
      return { ok: false, status, async json() { return {}; } };
    } });
    await assert.rejects(client.listHistory({ cursor: "1" }), error => error.errorClass === errorClass && !error.message.includes(token));
  }
});

test("EP15-004/EP11-004: Gmail resync enforces exact message and page bounds", async () => {
  const calls = [];
  const client = new GmailApiClient({ token: "test", fetchImpl: async url => {
    calls.push(url);
    return { ok: true, status: 200, async json() {
      const page = calls.length;
      return { messages: Array.from({ length: 100 }, (_, index) => ({ id: `m-${page}-${index}` })), nextPageToken: page < 5 ? `p-${page}` : "p-overflow" };
    } };
  } });
  await assert.rejects(client.listRecentMessageIds({ maxMessages: 501 }), /from 1 to 500/);
  const bounded = await client.listRecentMessageIds({ maxMessages: 500 });
  assert.equal(bounded.messageIds.length, 500);
  assert.equal(bounded.truncated, true);
  assert.equal(calls.length, 5);
});

async function cursorStore(t) {
  const directory = await mkdtemp(join(tmpdir(), "relay-email-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "email.sqlite");
  const store = new EmailCursorStore(path);
  t.after(() => store.close());
  return store;
}

function gmailMessage(id) {
  return {
    id, threadId: "thread-1", internalDate: "1788048000000",
    payload: { headers: [{ name: "From", value: "buyer@example.test" }], mimeType: "text/plain", body: { data: Buffer.from("Approved").toString("base64url") } },
  };
}

function registration(sessionId, waitId) {
  return { session_id: sessionId, waits: [{ wait_id: waitId, version: 0, status: "active", continuation: { artifacts: [{ kind: "email_thread", id: "gmail:a@b.test:t1" }] } }] };
}

function pushRequest({ authorization = "Bearer 0123456789abcdef" } = {}) {
  const data = Buffer.from(JSON.stringify({ emailAddress: "agent@example.test", historyId: "301" })).toString("base64");
  const request = Readable.from([JSON.stringify({ message: { messageId: "push-1", data } })]);
  request.method = "POST";
  request.headers = { "content-type": "application/json", authorization };
  return request;
}

function responseRecorder() { return { status: null, json: null, writeHead(status) { this.status = status; }, end(body) { this.json = JSON.parse(body); } }; }
function result(id) { return { duplicate: false, event: { event_id: id, state: "resolved" } }; }
