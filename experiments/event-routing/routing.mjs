import assert from "node:assert/strict";

import {
  buildSemanticRoutingPayload,
  callSemanticDecision,
  createSinglePassSemanticRouter,
  mergeRoutingTelemetry,
  semanticRoutingPolicyPrompt,
} from "../../packages/event-router/index.mjs";

import { getRoutableWaits } from "./evaluation.mjs";

const MAX_MODEL_ATTEMPTS = 2;

export function routeByMetadata(caseData) {
  if (isDuplicate(caseData)) {
    return {
      decision: {
        disposition: "deduplicate",
        actionable: null,
        deliveries: [],
        evidence: ["source event identity already exists"],
        summary: "Duplicate provider delivery.",
      },
      telemetry: emptyTelemetry(),
    };
  }

  const sender = normalize(caseData.event.from);
  const candidates = getRoutableWaits(caseData).filter(({ wait }) =>
    wait.actors.some((actor) => normalize(actor) === sender),
  );

  if (candidates.length === 0) {
    return {
      decision: {
        disposition: "escalate",
        actionable: true,
        deliveries: [],
        evidence: ["no exact sender-to-wait match"],
        summary: "Metadata cannot attach the event safely, so recall policy escalates it.",
      },
      telemetry: emptyTelemetry(),
    };
  }

  const bySession = new Map();
  for (const candidate of candidates) {
    const sessionId = candidate.session.session_id;
    const matches = bySession.get(sessionId) ?? [];
    matches.push(candidate);
    bySession.set(sessionId, matches);
  }
  const hasExclusiveConflict =
    bySession.size > 1 && candidates.some(({ wait }) => wait.exclusive === true);

  if (hasExclusiveConflict) {
    return {
      decision: {
        disposition: "escalate",
        actionable: true,
        deliveries: [],
        evidence: ["the sender matches multiple sessions with an exclusive wait"],
        summary: "Metadata alone cannot choose one exclusive session.",
      },
      telemetry: emptyTelemetry(),
    };
  }

  const deliveries = [...bySession.entries()].map(([sessionId, matches]) => ({
    session_id: sessionId,
    wait_ids: matches
      .filter(({ wait }) => wait.status === "active")
      .map(({ wait }) => wait.wait_id),
    relation: "exact sender metadata match",
    confidence: 1,
  }));

  return {
    decision: {
      disposition: "deliver",
      actionable: true,
      deliveries,
      evidence: ["event sender exactly matches the selected wait actors"],
      summary: "Exact sender metadata selected the target session.",
    },
    telemetry: emptyTelemetry(),
  };
}

export async function routeSinglePass(caseData, context) {
  if (isDuplicate(caseData)) {
    return routeByMetadata(caseData);
  }

  const router = createSinglePassSemanticRouter({
    adapter: context.adapter,
    maxAttempts: MAX_MODEL_ATTEMPTS,
    schemaPath: context.decisionSchemaPath,
  });
  return router.route({ event: caseData.event, sessions: caseData.sessions });
}

export async function routeTwoPass(caseData, context) {
  if (isDuplicate(caseData)) {
    return routeByMetadata(caseData);
  }

  const payload = buildSemanticRoutingPayload(caseData.event, caseData.sessions);
  const recallPrompt = buildRecallPrompt(payload);
  let recallResult;
  const telemetryParts = [];
  let lastRecallError;

  for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS; attempt += 1) {
    const retryNote = lastRecallError
      ? `\nThe previous response was invalid: ${lastRecallError.message}\nReturn a corrected result.`
      : "";
    let call;
    try {
      call = await context.adapter.call({
        prompt: recallPrompt + retryNote,
        schemaPath: context.recallSchemaPath,
      });
    } catch (error) {
      lastRecallError = error;
      continue;
    }
    telemetryParts.push(call.telemetry);
    try {
      validateRecall(caseData, call.output);
      recallResult = call.output;
      break;
    } catch (error) {
      lastRecallError = error;
    }
  }

  if (!recallResult) {
    throw lastRecallError ?? new Error("recall pass failed without an error");
  }

  const selectedPairs = new Set(
    recallResult.candidates
      .filter((candidate) => candidate.relevance !== "negative")
      .map((candidate) => `${candidate.session_id}\u0000${candidate.wait_id}`),
  );
  const selectedSessions = payload.sessions
    .map((session) => ({
      ...session,
      waits: session.waits.filter((wait) =>
        selectedPairs.has(`${session.session_id}\u0000${wait.wait_id}`),
      ),
    }))
    .filter((session) => session.waits.length > 0);

  const adjudicationPayload = {
    event: payload.event,
    candidate_sessions: selectedSessions,
    recall_result: recallResult,
  };
  const finalResult = await callSemanticDecision({
    adapter: context.adapter,
    event: caseData.event,
    sessions: caseData.sessions,
    payload: adjudicationPayload,
    task: "Adjudicate the recall result. You may still escalate or dismiss. Return only evidence-backed targets.",
    maxAttempts: MAX_MODEL_ATTEMPTS,
    schemaPath: context.decisionSchemaPath,
    label: caseData.id,
  });

  return {
    decision: finalResult.decision,
    telemetry: mergeRoutingTelemetry(...telemetryParts, finalResult.telemetry),
    recall: recallResult,
  };
}

function buildRecallPrompt(payload) {
  return `${semanticRoutingPolicyPrompt()}

Perform a high-recall first pass. Evaluate every candidate wait independently and
return every candidate exactly once. A candidate is positive when the event belongs
to its session or satisfies its wait, uncertain when the relationship is plausible,
and negative only when evidence weighs against a relationship. Do not choose a final
target in this pass.

<routing_data>
${JSON.stringify(payload, null, 2)}
</routing_data>`;
}

function validateRecall(caseData, recall) {
  assert.ok(recall && typeof recall === "object", `${caseData.id}: recall result is required`);
  assert.equal(typeof recall.actionable, "boolean", `${caseData.id}: recall actionable is invalid`);
  assert.ok(Array.isArray(recall.candidates), `${caseData.id}: recall candidates must be an array`);

  const expectedPairs = getRoutableWaits(caseData).map(
    ({ session, wait }) => `${session.session_id}\u0000${wait.wait_id}`,
  );
  const actualPairs = recall.candidates.map(
    (candidate) => `${candidate.session_id}\u0000${candidate.wait_id}`,
  );
  assert.equal(new Set(actualPairs).size, actualPairs.length, `${caseData.id}: duplicate recall row`);
  assert.deepEqual(
    [...actualPairs].sort(),
    [...expectedPairs].sort(),
    `${caseData.id}: recall must return every routable wait exactly once`,
  );
}

function isDuplicate(caseData) {
  if (!caseData.existing_event) {
    return false;
  }
  return (
    (caseData.event.source === caseData.existing_event.source &&
      caseData.event.source_event_id != null &&
      caseData.event.source_event_id === caseData.existing_event.source_event_id) ||
    caseData.event.fingerprint === caseData.existing_event.fingerprint
  );
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function emptyTelemetry() {
  return {
    model_calls: 0,
    latency_ms: 0,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
  };
}
