import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import { apply } from "../host-plugin.js";

test("EP15-008: Host wires deployment OIDC into the real HTTP handler and management state", async t => {
  const directory = await mkdtemp(join(tmpdir(), "relay-email-oidc-host-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const audience = "https://relay.example.test/api/relay/email/gmail/push";
  const serviceAccount = "relay-push@example-project.iam.gserviceaccount.com";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "host-key", alg: "RS256", use: "sig" };
  const now = Math.floor(Date.now() / 1000);
  let route;
  let management;
  const cleanups = [];
  const scope = {
    credentials: {
      async resolve() { return null; },
      async describe() { return { configured: false, writable: true }; },
    },
    relayEvents: {
      listWaits() { return []; },
      registerBoundEventSource() { return { async handleEvent() { throw new Error("initial push must not create an Event"); }, dispose() {} }; },
      registerConnectorProvider(provider) { management = provider; return () => undefined; },
    },
    webServer: { register(definition) { route = definition; return () => undefined; } },
    effect(setup) {
      const cleanup = setup();
      if (typeof cleanup === "function") cleanups.push(cleanup);
      return () => undefined;
    },
  };
  const ctx = {
    inject(_services, setup) { setup(scope); return { dispose() {} }; },
    effect() { return () => undefined; },
  };
  apply(ctx, {
    apiToken: "gmail-api-token-0123456789",
    databasePath: join(directory, "email.sqlite"),
    pushOidcAudience: audience,
    pushOidcServiceAccount: serviceAccount,
    pushOidcFetch: async () => ({ ok: true, status: 200, headers: new Headers(), async json() { return { keys: [jwk] }; } }),
  });
  t.after(() => { for (const cleanup of cleanups.reverse()) cleanup(); });

  const status = await management.inspect();
  assert.equal(status.push_configured, true);
  assert.equal(status.push_authentication, "google_oidc");
  assert.equal(status.credentials_writable, false);
  const response = recorder();
  await route.handler(pushRequest(jwt(privateKey, "host-key", {
    iss: "https://accounts.google.com", aud: audience, email: serviceAccount,
    email_verified: true, sub: "123", iat: now - 5, exp: now + 300,
  })), response);
  assert.equal(response.status, 202);
  assert.equal(response.json.initialized, true);
});

test("EP15-008: Host rejects a partial Pub/Sub OIDC deployment configuration", () => {
  assert.throws(() => apply({}, { pushOidcAudience: "https://relay.example.test/push" }),
    /requires both audience and service account/u);
  assert.throws(() => apply({}, { pushOidcServiceAccount: "relay@example-project.iam.gserviceaccount.com" }),
    /requires both audience and service account/u);
});

function jwt(privateKey, kid, payload) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${header}.${body}`;
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
}

function pushRequest(token) {
  const data = Buffer.from(JSON.stringify({ emailAddress: "agent@example.test", historyId: "301" })).toString("base64");
  const request = Readable.from([JSON.stringify({ message: { messageId: "pubsub-host-1", data } })]);
  request.method = "POST";
  request.headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  return request;
}

function recorder() {
  return { status: null, json: null, writeHead(status) { this.status = status; },
    end(body) { this.json = JSON.parse(body); } };
}
