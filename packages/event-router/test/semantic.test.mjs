import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSemanticRoutingPayload,
  createSinglePassSemanticRouter,
} from "../index.mjs";

test("single-pass semantic router retries invalid structured output", async () => {
  const prompts = [];
  const adapter = {
    model: "test-model",
    async call({ prompt, schemaPath }) {
      prompts.push({ prompt, schemaPath });
      if (prompts.length === 1) {
        return {
          output: deliver("unknown-session", "wait-quote"),
          telemetry: telemetry(10, 2),
        };
      }
      return {
        output: deliver("session-quote", "wait-quote"),
        telemetry: telemetry(12, 3),
      };
    },
  };
  const router = createSinglePassSemanticRouter({ adapter });

  const result = await router.route({ event: emailEvent(), sessions: [waitingSession()] });

  assert.equal(result.decision.deliveries[0].session_id, "session-quote");
  assert.equal(prompts.length, 2);
  assert.match(prompts[0].prompt, /untrusted evidence/);
  assert.match(prompts[1].prompt, /previous response was invalid/);
  assert.match(prompts[0].schemaPath, /packages\/event-router\/decision\.schema\.json$/);
  assert.deepEqual(result.telemetry, {
    model_calls: 2,
    latency_ms: 2,
    input_tokens: 22,
    cached_input_tokens: 0,
    output_tokens: 5,
  });
});

test("semantic payload exposes only routable session context", () => {
  const payload = buildSemanticRoutingPayload(emailEvent(), [
    waitingSession(),
    {
      session_id: "session-complete",
      state: "completed",
      task_summary: "Already done.",
      waits: [],
    },
  ]);

  assert.deepEqual(payload.sessions.map((session) => session.session_id), ["session-quote"]);
  assert.equal(payload.sessions[0].waits[0].wait_id, "wait-quote");
  assert.equal("context" in payload.sessions[0], false);
});

function deliver(sessionId, waitId) {
  return {
    disposition: "deliver",
    actionable: true,
    deliveries: [
      {
        session_id: sessionId,
        wait_ids: [waitId],
        relation: "accepts the quote",
        confidence: 0.99,
      },
    ],
    evidence: ["quote amount and acceptance match"],
    summary: "The customer accepted the quote.",
  };
}

function telemetry(inputTokens, outputTokens) {
  return {
    model_calls: 1,
    latency_ms: 1,
    input_tokens: inputTokens,
    cached_input_tokens: 0,
    output_tokens: outputTokens,
  };
}

function emailEvent() {
  return {
    event_id: "event-quote",
    source: "test-mail",
    fingerprint: "event-quote-fingerprint",
    from: "buyer@example.test",
    subject: "Approved",
    body: "The quote is approved.",
  };
}

function waitingSession() {
  return {
    session_id: "session-quote",
    state: "waiting",
    task_summary: "Close the quote.",
    context: { private_detail: "not routing context" },
    waits: [
      {
        wait_id: "wait-quote",
        status: "active",
        exclusive: true,
        expected_event: "Customer approves the quote.",
        caused_by: "Sent the quote.",
        actors: ["buyer@example.test"],
        entities: ["Quote Q-1"],
        phase: "approval",
        prior_exchange: "The customer requested a quote.",
      },
    ],
  };
}
