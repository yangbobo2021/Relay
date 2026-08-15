import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertFixtureSuite,
  evaluatePredictions,
  validateDecision,
} from "./evaluation.mjs";
import { routeByMetadata } from "./routing.mjs";

const experimentDirectory = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(experimentDirectory, "../../fixtures/email-routing/cases.json");
const suite = JSON.parse(await readFile(fixturePath, "utf8"));

test("fixture suite has valid internal structure", () => {
  assert.doesNotThrow(() => assertFixtureSuite(suite));
});

test("metadata router returns valid decisions for every case", () => {
  for (const caseData of suite.cases) {
    const result = routeByMetadata(caseData);
    assert.doesNotThrow(
      () => validateDecision(caseData, result.decision),
      `${caseData.id} returned an invalid decision`,
    );
  }
});

test("metadata router handles critical policy branches", () => {
  assert.equal(routeCase("duplicate_provider_delivery_is_deduplicated"), "deduplicate");
  assert.equal(routeCase("ambiguous_exclusive_reply_escalates_event"), "escalate");

  const multi = routeByMetadata(findCase("nonexclusive_incident_update_delivers_to_multiple_sessions"));
  assert.equal(multi.decision.disposition, "deliver");
  assert.deepEqual(
    multi.decision.deliveries.map((delivery) => delivery.session_id).sort(),
    ["session-graphicdesign-payment", "session-lucerne-payment"],
  );
});

test("evaluation is perfect when predictions equal expected outcomes", () => {
  const predictions = new Map(
    suite.cases.map((caseData) => [caseData.id, expectedPrediction(caseData)]),
  );
  const result = evaluatePredictions(suite.cases, predictions);

  assert.equal(result.metrics.disposition_accuracy, 1);
  assert.equal(result.metrics.actionable_coverage, 1);
  assert.equal(result.metrics.target_recall, 1);
  assert.equal(result.metrics.wrong_target_cases, 0);
  assert.ok(Object.values(result.gates).every(Boolean));
});

test("multi-session delivery rejects an exclusive wait", () => {
  const caseData = findCase("ambiguous_exclusive_reply_escalates_event");
  const decision = {
    disposition: "deliver",
    actionable: true,
    deliveries: caseData.sessions.map((session) => ({
      session_id: session.session_id,
      wait_ids: [session.waits[0].wait_id],
      relation: "unsafe test decision",
      confidence: 0.5,
    })),
    evidence: [],
    summary: "Invalid multi-session exclusive delivery.",
  };

  assert.throws(() => validateDecision(caseData, decision), /exclusive event/);
});

function routeCase(caseId) {
  return routeByMetadata(findCase(caseId)).decision.disposition;
}

function findCase(caseId) {
  return suite.cases.find((caseData) => caseData.id === caseId);
}

function expectedPrediction(caseData) {
  const expected = caseData.expected;
  if (expected.disposition === "deduplicate") {
    return routeByMetadata(caseData);
  }

  const deliveries = expected.target_session_ids.map((sessionId) => {
    const sessionWaitIds = new Set(
      caseData.sessions
        .find((session) => session.session_id === sessionId)
        .waits.map((wait) => wait.wait_id),
    );
    return {
      session_id: sessionId,
      wait_ids: expected.matched_wait_ids.filter((waitId) => sessionWaitIds.has(waitId)),
      relation: "fixture expected relationship",
      confidence: 1,
    };
  });

  return {
    decision: {
      disposition: expected.disposition,
      actionable: expected.disposition !== "dismiss",
      deliveries,
      evidence: [expected.reason],
      summary: expected.reason,
    },
    telemetry: {
      model_calls: 0,
      latency_ms: 0,
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
    },
  };
}
