import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";

import { createGitHubWebhookHandler, resolveGitHubBinding } from "../src/webhook.mjs";

const SECRET = "0123456789abcdef0123456789abcdef";

test("EP04-001/EP03-001: valid HMAC binds one active artifact and acknowledges after durable handling", async () => {
  const order = [];
  const boundCalls = [];
  const registration = registrationFixture();
  const handler = createGitHubWebhookHandler({
    webhookSecrets: [SECRET],
    relayEvents: {
      listWaits() { return [registration]; },
      async handleEvent() { throw new Error("unbound route must not run"); },
    },
    boundSource: { async dismissEvent({ event }) { return result(event.source_event_id, "resolved", "dismiss"); }, async handleEvent(input) {
      order.push("durable");
      boundCalls.push(input);
      return result("event-1", "resolved", "deliver");
    } },
  });
  const response = responseRecorder(order);
  await handler(signedRequest(pullPayload()), response);
  assert.deepEqual(order, ["durable", "response"]);
  assert.equal(response.status, 202);
  assert.equal(boundCalls.length, 1);
  assert.deepEqual(boundCalls[0].binding, {
    session_id: "session-1",
    wait_id: "wait-1",
    wait_version: 3,
    source_subject: "octo/relay#42",
  });
  assert.equal(boundCalls[0].event.outcome, "failure");
});

test("EP04-003: missing, malformed, wrong, and body-mutated signatures persist nothing", async () => {
  let calls = 0;
  const handler = createGitHubWebhookHandler({
    webhookSecrets: SECRET,
    relayEvents: { listWaits: () => [], async handleEvent() { calls += 1; } },
    boundSource: { async dismissEvent({ event }) { calls += 1; return result(event.source_event_id, "resolved", "dismiss"); }, async handleEvent({ event }) { calls += 1; return result(event.source_event_id, "resolved", "dismiss"); } },
  });
  for (const headers of [
    { "x-hub-signature-256": undefined },
    { "x-hub-signature-256": "sha1=bad" },
    { "x-hub-signature-256": `sha256=${"0".repeat(64)}` },
  ]) {
    const response = responseRecorder();
    await handler(signedRequest(pullPayload(), headers), response);
    assert.equal(response.status, 401);
  }
  const body = Buffer.from(JSON.stringify(pullPayload()));
  const signature = sign(body);
  const mutated = { ...pullPayload(), action: "rerequested" };
  const response = responseRecorder();
  await handler(signedRequest(mutated, { "x-hub-signature-256": signature }), response);
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("EP11-001: webhook secret rotation, revocation, and handler restart take effect per request", async () => {
  const oldSecret = "old-secret-0123456789abcdef";
  const newSecret = "new-secret-0123456789abcdef";
  let active = [oldSecret];
  let calls = 0;
  const options = {
    webhookSecrets: async () => active,
    relayEvents: { listWaits: () => [], async handleEvent(event) { calls += 1; return result(event.source_event_id, "resolved", "dismiss"); } },
    boundSource: { async dismissEvent({ event }) { calls += 1; return result(event.source_event_id, "resolved", "dismiss"); }, async handleEvent({ event }) { calls += 1; return result(event.source_event_id, "resolved", "dismiss"); } },
  };
  let handler = createGitHubWebhookHandler(options);
  assert.equal(await sendWithSecret(handler, oldSecret, "rotate-1"), 202);

  active = [newSecret, oldSecret];
  assert.equal(await sendWithSecret(handler, oldSecret, "rotate-2"), 202, "old secret remains valid during overlap");
  assert.equal(await sendWithSecret(handler, newSecret, "rotate-3"), 202, "new secret is immediately valid");

  active = [newSecret];
  const revoked = responseRecorder();
  await handler(signedRequestWithSecret(pullPayload(), oldSecret, "rotate-4"), revoked);
  assert.equal(revoked.status, 401, "revoked old material fails immediately");
  assert.doesNotMatch(JSON.stringify(revoked.json), new RegExp(`${oldSecret}|${newSecret}`, "u"));

  handler = createGitHubWebhookHandler(options);
  assert.equal(await sendWithSecret(handler, newSecret, "rotate-5"), 202, "a recreated handler resolves the persisted active value");
  active = [];
  const unconfigured = responseRecorder();
  await handler(signedRequestWithSecret(pullPayload(), newSecret, "rotate-6"), unconfigured);
  assert.equal(unconfigured.status, 503);
  assert.equal(unconfigured.json.error, "github_delivery_failed");
  assert.equal(calls, 4);
});

test("EP04-008/EP11-003/007: request bounds, encoding, complexity, and rate limits fail before persistence", async () => {
  let calls = 0;
  let now = 0;
  const handler = createGitHubWebhookHandler({
    webhookSecrets: SECRET,
    maxBodyBytes: 256,
    requestsPerMinute: 2,
    clock: () => now,
    relayEvents: { listWaits: () => [], async handleEvent(event) { calls += 1; return result(event.source_event_id, "resolved", "dismiss"); } },
    boundSource: { async dismissEvent({ event }) { calls += 1; return result(event.source_event_id, "resolved", "dismiss"); }, async handleEvent({ event }) { calls += 1; return result(event.source_event_id, "resolved", "dismiss"); } },
  });
  const encoded = responseRecorder();
  await handler(signedRequest(pullPayload(), { "content-encoding": "gzip" }), encoded);
  assert.equal(encoded.status, 415);
  const oversized = responseRecorder();
  await handler(signedRequest({ padding: "x".repeat(512) }), oversized);
  assert.equal(oversized.status, 413);
  const limited = responseRecorder();
  await handler(signedRequest(pullPayload()), limited);
  assert.equal(limited.status, 429);
  assert.equal(calls, 0);
  now = 60_000;
  const recovered = responseRecorder();
  await handler(signedRequest({ event: "unsupported" }, { "x-github-event": "ping" }), recovered);
  assert.equal(recovered.status, 202);
  assert.equal(calls, 1);
});

test("EP03-006: ambiguous GitHub artifact binding never selects the first Session", () => {
  const a = registrationFixture();
  const b = structuredClone(a);
  b.session_id = "session-2";
  b.waits[0].wait_id = "wait-2";
  assert.equal(resolveGitHubBinding([a, b], "octo/relay#42"), null);
});

function registrationFixture() {
  return {
    session_id: "session-1",
    waits: [{ wait_id: "wait-1", version: 3, status: "active", continuation: { artifacts: [{ kind: "github_pull_request", id: "octo/relay#42" }] } }],
    monitors: [],
  };
}

function pullPayload() {
  return {
    action: "completed",
    repository: { full_name: "Octo/Relay" },
    check_run: { id: 9, head_sha: "abc123", conclusion: "failure", pull_requests: [{ number: 42, head: { sha: "abc123" } }] },
  };
}

function signedRequest(payload, overrides = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  const stream = Readable.from([body]);
  stream.method = "POST";
  stream.headers = {
    "content-type": "application/json",
    "content-length": String(body.length),
    "x-github-event": "check_run",
    "x-github-delivery": "delivery-1",
    "x-hub-signature-256": sign(body),
    ...overrides,
  };
  return stream;
}

function signedRequestWithSecret(payload, secret, delivery) {
  const body = Buffer.from(JSON.stringify(payload));
  return signedRequest(payload, {
    "x-github-delivery": delivery,
    "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
  });
}

async function sendWithSecret(handler, secret, delivery) {
  const response = responseRecorder();
  await handler(signedRequestWithSecret(pullPayload(), secret, delivery), response);
  return response.status;
}

function sign(body) { return `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`; }

function responseRecorder(order = []) {
  return { status: null, json: null, writeHead(status) { this.status = status; }, end(body) { this.json = JSON.parse(body); order.push("response"); } };
}

function result(id, state, disposition) {
  return { duplicate: false, event: { event_id: id, state, decision: { disposition } } };
}
