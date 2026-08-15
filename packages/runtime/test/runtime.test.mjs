import assert from "node:assert/strict";
import test from "node:test";

import { RelayRuntime, RelayStore } from "../index.mjs";

test("an Agent registers waits and Relay injects a matched event without running the conversation", async () => {
  const store = new RelayStore();
  const accepted = [];
  const runtime = runtimeFor(store, {
    router: fixedRouter(deliver("dsh-session-quote", ["wait-quote"], "customer accepted")),
    inbox: recordingInbox(accepted),
  });

  const registered = await runtime.registerWaits({
    sessionId: "dsh-session-quote",
    taskSummary: "Follow a customer quote.",
    context: { project: "northwind" },
    waits: [quoteWait()],
  });
  assert.equal(registered.waits[0].status, "active");
  assert.equal("runs" in registered, false);

  const handled = await runtime.handleEvent(emailEvent("event-accepted", "Accepted", "We accept Q-1."));

  assert.equal(handled.dispatchResults[0].status, "accepted");
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].sessionId, "dsh-session-quote");
  assert.equal(accepted[0].deliveries[0].event.subject, "Accepted");
  assert.equal(handled.event.state, "resolved");
  const projection = store.inspectWaitRegistration("dsh-session-quote");
  assert.equal(projection.waits[0].status, "consumed");
  assert.equal("runs" in projection, false);
  assert.equal(store.getActivation(accepted[0].activationId).state, "committed");
  store.close();
});

test("the same DSH conversation can register a replacement wait after every event", async () => {
  const store = new RelayStore();
  const accepted = [];
  let waitId = "wait-quote";
  const runtime = runtimeFor(store, {
    router: {
      async route() {
        return deliver("dsh-session-cycle", [waitId], `matched ${waitId}`);
      },
    },
    inbox: recordingInbox(accepted),
  });

  await runtime.registerWaits({
    sessionId: "dsh-session-cycle",
    taskSummary: "Complete a two-stage sale.",
    waits: [quoteWait()],
  });
  await runtime.handleEvent(emailEvent("event-quote", "Quote", "Approved."));

  waitId = "wait-signature";
  await runtime.registerWaits({
    sessionId: "dsh-session-cycle",
    taskSummary: "Complete a two-stage sale.",
    context: { stage: "signature" },
    waits: [signatureWait()],
  });
  await runtime.handleEvent(emailEvent("event-signature", "Contract", "Signed copy attached."));

  assert.equal(accepted.length, 2);
  assert.notEqual(accepted[0].activationId, accepted[1].activationId);
  assert.deepEqual(
    store.inspectWaitRegistration("dsh-session-cycle").waits.map((wait) => wait.status),
    ["consumed", "consumed"],
  );
  store.close();
});

test("a failed inbox delivery retries with the same activation id", async () => {
  const store = new RelayStore();
  const attempts = [];
  let fail = true;
  const runtime = runtimeFor(store, {
    router: fixedRouter(deliver("dsh-session-retry", ["wait-quote"], "customer accepted")),
    inbox: {
      async deliver(input) {
        attempts.push(input.activationId);
        if (fail) {
          fail = false;
          throw new Error("DSH host unavailable");
        }
      },
    },
  });
  await runtime.registerWaits({
    sessionId: "dsh-session-retry",
    taskSummary: "Retry delivery safely.",
    waits: [quoteWait()],
  });
  const event = emailEvent("event-retry", "Accepted", "Approved.");

  const first = await runtime.handleEvent(event);
  const second = await runtime.handleEvent(event);

  assert.equal(first.dispatchResults[0].status, "retry");
  assert.equal(second.dispatchResults[0].status, "accepted");
  assert.equal(second.duplicate, true);
  assert.deepEqual(attempts, [attempts[0], attempts[0]]);
  assert.equal(store.inspectEvent("event-retry").state, "resolved");
  store.close();
});

test("an event queued during another Relay delivery is drained in DSH inbox order", async () => {
  const store = new RelayStore();
  const firstEntered = deferred();
  const releaseFirst = deferred();
  const acceptedEvents = [];
  const runtime = runtimeFor(store, {
    router: {
      async route({ event }) {
        return deliver("dsh-session-serial", [], `related event ${event.event_id}`);
      },
    },
    inbox: {
      async deliver({ deliveries }) {
        acceptedEvents.push(deliveries[0].event.event_id);
        if (acceptedEvents.length === 1) {
          firstEntered.resolve();
          await releaseFirst.promise;
        }
      },
    },
  });
  await runtime.registerWaits({
    sessionId: "dsh-session-serial",
    taskSummary: "Process related updates in order.",
    waits: [providerWait("wait-provider-serial")],
  });

  const first = runtime.handleEvent(emailEvent("event-serial-1", "Update 1", "First."));
  await firstEntered.promise;
  const second = await runtime.handleEvent(emailEvent("event-serial-2", "Update 2", "Second."));
  assert.equal(second.dispatchResults[0].status, "busy");
  releaseFirst.resolve();
  const firstResult = await first;

  assert.deepEqual(acceptedEvents, ["event-serial-1", "event-serial-2"]);
  assert.equal(firstResult.dispatchResults[0].activationIds.length, 2);
  assert.equal(store.inspectEvent("event-serial-2").state, "resolved");
  store.close();
});

test("one non-exclusive event can be injected into multiple waiting conversations", async () => {
  const store = new RelayStore();
  const accepted = [];
  const runtime = runtimeFor(store, {
    router: fixedRouter({
      disposition: "deliver",
      actionable: true,
      deliveries: [
        target("dsh-session-a", "wait-provider-a"),
        target("dsh-session-b", "wait-provider-b"),
      ],
      evidence: ["shared provider recovery"],
      summary: "The provider recovered.",
    }),
    inbox: recordingInbox(accepted),
  });
  for (const suffix of ["a", "b"]) {
    await runtime.registerWaits({
      sessionId: `dsh-session-${suffix}`,
      taskSummary: `Wait for provider recovery ${suffix}.`,
      waits: [providerWait(`wait-provider-${suffix}`)],
    });
  }

  await runtime.handleEvent(emailEvent("event-provider", "Recovered", "Service is healthy."));

  assert.deepEqual(accepted.map((item) => item.sessionId).sort(), ["dsh-session-a", "dsh-session-b"]);
  store.close();
});

test("an actionable unmatched event is escalated without creating a conversation", async () => {
  const store = new RelayStore();
  const runtime = runtimeFor(store, {
    router: fixedRouter({
      disposition: "escalate",
      actionable: true,
      deliveries: [],
      evidence: ["business inquiry with no matching wait"],
      summary: "A new inquiry needs an owner.",
    }),
    inbox: recordingInbox([]),
  });

  const result = await runtime.handleEvent(emailEvent("event-unmatched", "Pricing", "Please quote us."));

  assert.equal(result.event.state, "resolved");
  assert.equal(result.event.decision.disposition, "escalate");
  assert.equal(result.registrations.length, 0);
  assert.deepEqual(store.listWaitRegistrations(), []);
  store.close();
});

test("the Agent can cancel waits after handling an ordinary user message", async () => {
  const store = new RelayStore();
  const runtime = runtimeFor(store, {
    router: fixedRouter({
      disposition: "dismiss",
      actionable: false,
      deliveries: [],
      evidence: ["unused"],
      summary: "unused",
    }),
    inbox: recordingInbox([]),
  });
  await runtime.registerWaits({
    sessionId: "dsh-session-user-message",
    taskSummary: "Wait until the user changes direction.",
    waits: [quoteWait()],
  });

  const cancelled = runtime.cancelWaits("dsh-session-user-message");

  assert.equal(cancelled.waits[0].status, "cancelled");
  assert.deepEqual(runtime.listWaits(), []);
  store.close();
});

function runtimeFor(store, { router, inbox }) {
  return new RelayRuntime({ store, router, inbox, workerId: "test-dispatcher" });
}

function recordingInbox(targets) {
  return {
    async deliver(input) {
      targets.push(structuredClone(input));
      return { accepted: true };
    },
  };
}

function fixedRouter(decision) {
  return { async route() { return structuredClone(decision); } };
}

function deliver(sessionId, waitIds, relation) {
  return {
    disposition: "deliver",
    actionable: true,
    deliveries: [{ session_id: sessionId, wait_ids: waitIds, relation, confidence: 1 }],
    evidence: [relation],
    summary: relation,
  };
}

function target(sessionId, waitId) {
  return {
    session_id: sessionId,
    wait_ids: [waitId],
    relation: "shared provider recovery",
    confidence: 1,
  };
}

function emailEvent(id, subject, body) {
  return {
    event_id: id,
    source: "email",
    source_event_id: `message-${id}`,
    fingerprint: `fingerprint-${id}`,
    from: "buyer@example.test",
    subject,
    body,
  };
}

function quoteWait() {
  return wait("wait-quote", true, "Customer approves the quote.");
}

function signatureWait() {
  return wait("wait-signature", true, "Customer returns the signed contract.");
}

function providerWait(waitId) {
  return wait(waitId, false, "Provider reports recovery.");
}

function wait(waitId, exclusive, expectedEvent) {
  return {
    wait_id: waitId,
    phase: "follow_up",
    exclusive,
    expected_event: expectedEvent,
    caused_by: "The Agent delegated an external wait.",
    actors: ["buyer@example.test"],
    entities: ["Q-1"],
    prior_exchange: "The ordinary DSH conversation is waiting for a response.",
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
