import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import {
  createRelayEventHandler,
  registerRelayEventIngress,
  RELAY_EVENT_PATH,
} from "../event-ingress.js";

test("registers an exact DSH Web route", () => {
  let registration;
  const dispose = () => {};
  const result = registerRelayEventIngress({
    webServer: {
      register(value) {
        registration = value;
        return dispose;
      },
    },
  }, {
    relayRuntime: { handleEvent() {} },
  });

  assert.equal(result, dispose);
  assert.equal(registration.kind, "exact");
  assert.equal(registration.path, RELAY_EVENT_PATH);
  assert.equal(typeof registration.handler, "function");
});

test("accepts a loopback event and returns durable delivery details", async () => {
  const received = [];
  const handler = createRelayEventHandler({
    relayRuntime: {
      async handleEvent(event) {
        received.push(event);
        return runtimeResult();
      },
    },
  });
  const response = responseRecorder();

  await handler(request({
    body: { type: "customer.email.received", source_event_id: "mail-42", marker: "ready" },
  }), response);

  assert.equal(response.status, 200);
  assert.deepEqual(response.json, {
    accepted: true,
    duplicate: false,
    event_id: "event-1",
    state: "resolved",
    deliveries: [{
      delivery_id: "delivery-1",
      session_id: "dsh-1",
      state: "resolved",
      wait_ids: ["wait-1"],
    }],
  });
  assert.equal(received[0].type, "customer.email.received");
  assert.equal(received[0].source, "webhook");
  assert.equal(received[0].source_event_id, "mail-42");
  assert.match(received[0].fingerprint, /^[a-f0-9]{64}$/);
});

test("requires the configured bearer token outside loopback", async () => {
  let calls = 0;
  const handler = createRelayEventHandler({
    token: "secret-token",
    relayRuntime: {
      async handleEvent() {
        calls += 1;
        return runtimeResult();
      },
    },
  });
  const denied = responseRecorder();
  await handler(request({ remoteAddress: "10.0.0.8", body: { type: "build.completed" } }), denied);
  assert.equal(denied.status, 403);
  assert.equal(calls, 0);

  const accepted = responseRecorder();
  await handler(request({
    remoteAddress: "10.0.0.8",
    headers: { authorization: "Bearer secret-token" },
    body: { type: "build.completed" },
  }), accepted);
  assert.equal(accepted.status, 200);
  assert.equal(calls, 1);
});

test("rejects invalid and oversized event bodies", async () => {
  const handler = createRelayEventHandler({
    maxBodyBytes: 16,
    relayRuntime: { async handleEvent() { throw new Error("must not run"); } },
  });
  const missingType = responseRecorder();
  await handler(request({ body: {} }), missingType);
  assert.equal(missingType.status, 400);
  assert.equal(missingType.json.error, "invalid_event");

  const oversized = responseRecorder();
  await handler(request({ body: { type: "long.event.name" } }), oversized);
  assert.equal(oversized.status, 413);
  assert.equal(oversized.json.error, "payload_too_large");
});

test("reports Relay delivery failures as server errors", async () => {
  const handler = createRelayEventHandler({
    relayRuntime: { async handleEvent() { throw new Error("database unavailable"); } },
  });
  const response = responseRecorder();
  await handler(request({ body: { type: "build.completed" } }), response);
  assert.equal(response.status, 500);
  assert.equal(response.json.error, "event_delivery_failed");
});

function request({
  body,
  method = "POST",
  remoteAddress = "127.0.0.1",
  headers = {},
} = {}) {
  const stream = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  stream.method = method;
  stream.headers = { "content-type": "application/json", ...headers };
  stream.socket = { remoteAddress };
  return stream;
}

function responseRecorder() {
  return {
    status: null,
    headers: null,
    body: "",
    json: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body += body;
      this.json = this.body ? JSON.parse(this.body) : null;
    },
  };
}

function runtimeResult() {
  return {
    duplicate: false,
    event: {
      event_id: "event-1",
      state: "resolved",
      deliveries: [{
        delivery_id: "delivery-1",
        session_id: "dsh-1",
        state: "resolved",
        wait_ids: ["wait-1"],
      }],
    },
  };
}
