import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";

import { createGmailPushHandler } from "../src/connector.mjs";
import { GmailPubSubOidcVerifier } from "../src/pubsub-oidc.mjs";

const now = 1_788_048_000;
const audience = "https://relay.example.test/api/relay/email/gmail/push";
const serviceAccount = "relay-push@example-project.iam.gserviceaccount.com";

test("EP15-001/008: Google Pub/Sub OIDC reaches Gmail sync and caches the verified JWKS", async () => {
  const signing = keys("active-key");
  let jwksCalls = 0;
  const verifier = new GmailPubSubOidcVerifier({
    audience,
    serviceAccount,
    clock: () => now * 1000,
    fetchImpl: async () => {
      jwksCalls += 1;
      return response({ keys: [signing.jwk] }, { "cache-control": "public, max-age=600" });
    },
  });
  let syncCalls = 0;
  const handler = createGmailPushHandler({
    verifyPush: request => verifier.verify(request),
    connector: { async sync(input) {
      syncCalls += 1;
      assert.equal(input.account, "agent@example.test");
      return { initialized: false, cursor: { cursor: "301" }, events: [{ event_id: "m1" }] };
    } },
  });
  const token = jwt(signing.privateKey, "active-key", claims());
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = recorder();
    await handler(pushRequest(token), result);
    assert.equal(result.status, 202);
    assert.equal(result.json.event_count, 1);
  }
  assert.equal(syncCalls, 2);
  assert.equal(jwksCalls, 1, "valid cached Google keys must avoid one fetch per push");
});

test("EP15-008: Pub/Sub OIDC fails closed for malformed, forged, stale, and wrong-identity tokens", async () => {
  const signing = keys("active-key");
  const attacker = keys("attacker-key");
  const verifier = new GmailPubSubOidcVerifier({
    audience,
    serviceAccount,
    clock: () => now * 1000,
    fetchImpl: async () => response({ keys: [signing.jwk] }),
  });
  const invalid = [
    "not-a-jwt",
    jwt(attacker.privateKey, "active-key", claims()),
    jwt(signing.privateKey, "active-key", claims({ aud: "https://wrong.example.test" })),
    jwt(signing.privateKey, "active-key", claims({ email: "attacker@example.test" })),
    jwt(signing.privateKey, "active-key", claims({ email_verified: false })),
    jwt(signing.privateKey, "active-key", claims({ iss: "https://issuer.example.test" })),
    jwt(signing.privateKey, "active-key", claims({ exp: now - 61 })),
    jwt(signing.privateKey, "active-key", claims({ iat: now + 61 })),
    jwt(signing.privateKey, "active-key", claims({ iat: now - 4_000, exp: now + 1 })),
  ];
  for (const token of invalid) {
    await assert.rejects(verifier.verify({ headers: { authorization: `Bearer ${token}` } }),
      error => error.errorClass === "unauthorized" && error.statusCode === 401 && !error.message.includes(token));
  }
  await assert.rejects(verifier.verify({ headers: {} }), error => error.errorClass === "unauthorized");
});

test("EP15-008: missing or unavailable Google verification keys never fall back to an unverified push", async () => {
  const signing = keys("missing-key");
  for (const fetchImpl of [
    async () => { throw new Error("network detail must stay private"); },
    async () => response({ keys: [] }),
    async () => ({ ok: false, status: 503, headers: new Headers(), async json() { return {}; } }),
  ]) {
    const verifier = new GmailPubSubOidcVerifier({ audience, serviceAccount,
      clock: () => now * 1000, fetchImpl });
    await assert.rejects(verifier.verify({ headers: { authorization:
      `Bearer ${jwt(signing.privateKey, "missing-key", claims())}` } }),
    error => error.errorClass === "push_verification_unavailable" && error.statusCode === 503);
  }
});

function keys(kid) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" } };
}

function claims(patch = {}) {
  return { iss: "https://accounts.google.com", aud: audience, email: serviceAccount,
    email_verified: true, sub: "1234567890", iat: now - 10, exp: now + 300, ...patch };
}

function jwt(privateKey, kid, payload) {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${encodedHeader}.${encodedPayload}`;
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
}

function pushRequest(token) {
  const data = Buffer.from(JSON.stringify({ emailAddress: "agent@example.test", historyId: "301" })).toString("base64");
  const request = Readable.from([JSON.stringify({ message: { messageId: "pubsub-1", data } })]);
  request.method = "POST";
  request.headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  return request;
}

function recorder() {
  return { status: null, json: null, writeHead(status) { this.status = status; },
    end(body) { this.json = JSON.parse(body); } };
}

function response(body, headers = {}) {
  return { ok: true, status: 200, headers: new Headers(headers), async json() { return body; } };
}
