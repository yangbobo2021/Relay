import assert from "node:assert/strict";

import { validateRoutingDecision } from "../../packages/event-router/decision.mjs";

const ROUTABLE_WAIT_STATES = new Set(["active", "claimed"]);

export function getRoutableWaits(caseData) {
  return caseData.sessions.flatMap((session) =>
    session.waits
      .filter((wait) => ROUTABLE_WAIT_STATES.has(wait.status))
      .map((wait) => ({ session, wait })),
  );
}

export function assertFixtureSuite(suite) {
  assert.equal(suite.suite, "email-routing", "unexpected fixture suite");
  assert.ok(Number.isInteger(suite.version) && suite.version > 0, "invalid suite version");
  assert.ok(Array.isArray(suite.cases) && suite.cases.length > 0, "fixture suite is empty");

  assertUnique(suite.cases.map((caseData) => caseData.id), "case IDs");
  assertUnique(suite.cases.map((caseData) => caseData.event.event_id), "event IDs");

  for (const caseData of suite.cases) {
    assert.ok(caseData.id, "case ID is required");
    assert.ok(Array.isArray(caseData.sessions), `${caseData.id}: sessions must be an array`);
    assert.ok(caseData.event, `${caseData.id}: event is required`);
    assert.ok(caseData.expected, `${caseData.id}: expected outcome is required`);

    const sessionIds = caseData.sessions.map((session) => session.session_id);
    const waitIds = caseData.sessions.flatMap((session) =>
      session.waits.map((wait) => wait.wait_id),
    );
    assertUnique(sessionIds, `${caseData.id}: session IDs`);
    assertUnique(waitIds, `${caseData.id}: wait IDs`);

    for (const targetId of caseData.expected.target_session_ids) {
      assert.ok(sessionIds.includes(targetId), `${caseData.id}: unknown expected target ${targetId}`);
    }
    for (const targetId of caseData.expected.must_not_target_session_ids) {
      assert.ok(sessionIds.includes(targetId), `${caseData.id}: unknown forbidden target ${targetId}`);
    }
  }
}

export function validateDecision(caseData, decision) {
  return validateRoutingDecision({
    decision,
    sessions: caseData.sessions,
    allowDeduplicate: true,
    canDeduplicate: Boolean(caseData.existing_event),
    label: caseData.id,
  });
}

export function evaluatePredictions(cases, predictions) {
  const totals = {
    cases: cases.length,
    failures: 0,
    disposition_correct: 0,
    actionable: 0,
    actionable_covered: 0,
    expected_targets: 0,
    recalled_targets: 0,
    expected_waits: 0,
    recalled_waits: 0,
    exact_target_cases: 0,
    exact_wait_cases: 0,
    wrong_target_cases: 0,
    wrong_wait_cases: 0,
    exclusive_misroute_cases: 0,
    escalate_overhead_cases: 0,
    unnecessary_dismiss_cases: 0,
    duplicate_execution_count: 0,
    delivery_mode_correct: 0,
    delivery_mode_cases: 0,
    model_calls: 0,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    latency_ms: 0,
  };

  const caseResults = [];

  for (const caseData of cases) {
    const result = predictions.get(caseData.id);
    const expected = caseData.expected;
    const expectedTargets = new Set(expected.target_session_ids);
    const expectedWaits = new Set(expected.matched_wait_ids);
    const forbiddenTargets = new Set(expected.must_not_target_session_ids);

    if (!result || result.error) {
      totals.failures += 1;
      caseResults.push({
        case_id: caseData.id,
        critical: caseData.critical,
        expected,
        error: result?.error ?? "missing prediction",
      });
      continue;
    }

    const decision = validateDecision(caseData, result.decision);
    const predictedTargets = new Set(
      decision.deliveries.map((delivery) => delivery.session_id),
    );
    const predictedWaits = new Set(
      decision.deliveries.flatMap((delivery) => delivery.wait_ids),
    );
    const wrongTargets = difference(predictedTargets, expectedTargets);
    const wrongWaits = difference(predictedWaits, expectedWaits);
    const targetMisses = difference(expectedTargets, predictedTargets);
    const waitMisses = difference(expectedWaits, predictedWaits);
    const forbiddenHits = intersection(predictedTargets, forbiddenTargets);

    const expectedActionable = expected.disposition === "deliver" || expected.disposition === "escalate";
    const covered = decision.disposition === "deliver" || decision.disposition === "escalate";
    const exactTargets = setsEqual(expectedTargets, predictedTargets);
    const exactWaits = setsEqual(expectedWaits, predictedWaits);

    totals.disposition_correct += Number(decision.disposition === expected.disposition);
    totals.actionable += Number(expectedActionable);
    totals.actionable_covered += Number(expectedActionable && covered);
    totals.expected_targets += expectedTargets.size;
    totals.recalled_targets += intersection(predictedTargets, expectedTargets).size;
    totals.expected_waits += expectedWaits.size;
    totals.recalled_waits += intersection(predictedWaits, expectedWaits).size;
    totals.exact_target_cases += Number(exactTargets);
    totals.exact_wait_cases += Number(exactWaits);
    totals.wrong_target_cases += Number(wrongTargets.size > 0);
    totals.wrong_wait_cases += Number(wrongWaits.size > 0);
    totals.exclusive_misroute_cases += Number(forbiddenHits.size > 0);
    totals.escalate_overhead_cases += Number(
      expected.disposition === "deliver" && decision.disposition === "escalate",
    );
    totals.unnecessary_dismiss_cases += Number(expectedActionable && decision.disposition === "dismiss");
    totals.duplicate_execution_count += Number(
      expected.disposition === "deduplicate" && decision.disposition !== "deduplicate",
    );

    if (expected.delivery_mode) {
      const modes = decision.deliveries.map((delivery) => {
        const session = caseData.sessions.find(
          (candidate) => candidate.session_id === delivery.session_id,
        );
        return session?.state === "running" ? "queue" : "start";
      });
      totals.delivery_mode_cases += 1;
      totals.delivery_mode_correct += Number(
        modes.length > 0 && modes.every((mode) => mode === expected.delivery_mode),
      );
    }

    const telemetry = result.telemetry ?? {};
    totals.model_calls += telemetry.model_calls ?? 0;
    totals.input_tokens += telemetry.input_tokens ?? 0;
    totals.cached_input_tokens += telemetry.cached_input_tokens ?? 0;
    totals.output_tokens += telemetry.output_tokens ?? 0;
    totals.latency_ms += telemetry.latency_ms ?? 0;

    caseResults.push({
      case_id: caseData.id,
      critical: caseData.critical,
      expected,
      decision,
      checks: {
        disposition_correct: decision.disposition === expected.disposition,
        actionable_covered: !expectedActionable || covered,
        exact_targets: exactTargets,
        exact_waits: exactWaits,
        target_misses: [...targetMisses],
        wait_misses: [...waitMisses],
        wrong_targets: [...wrongTargets],
        wrong_waits: [...wrongWaits],
        forbidden_targets: [...forbiddenHits],
      },
      telemetry,
    });
  }

  const criticalResults = caseResults.filter((result) => result.critical);
  const criticalActionableCovered = criticalResults.every(
    (result) => result.error == null && result.checks?.actionable_covered === true,
  );
  const criticalTargetsRecalled = criticalResults.every(
    (result) =>
      result.error == null &&
      (result.expected.disposition !== "deliver" || result.checks?.exact_targets === true),
  );
  const exclusiveTargetsSafe = caseResults.every(
    (result) => result.error == null && (result.checks?.forbidden_targets.length ?? 0) === 0,
  );

  return {
    metrics: {
      ...totals,
      disposition_accuracy: rate(totals.disposition_correct, totals.cases),
      actionable_coverage: rate(totals.actionable_covered, totals.actionable),
      target_recall: rate(totals.recalled_targets, totals.expected_targets),
      matched_wait_recall: rate(totals.recalled_waits, totals.expected_waits),
      exact_target_accuracy: rate(totals.exact_target_cases, totals.cases),
      exact_wait_accuracy: rate(totals.exact_wait_cases, totals.cases),
      delivery_mode_accuracy: rate(totals.delivery_mode_correct, totals.delivery_mode_cases),
      average_latency_ms: rate(totals.latency_ms, Math.max(1, totals.model_calls)),
    },
    gates: {
      critical_actionable_coverage: criticalActionableCovered,
      critical_targets_recalled: criticalTargetsRecalled,
      exclusive_targets_safe: exclusiveTargetsSafe,
      duplicate_execution_free: totals.duplicate_execution_count === 0,
      no_evaluation_failures: totals.failures === 0,
    },
    cases: caseResults,
  };
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

function difference(left, right) {
  return new Set([...left].filter((value) => !right.has(value)));
}

function intersection(left, right) {
  return new Set([...left].filter((value) => right.has(value)));
}

function setsEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function rate(numerator, denominator) {
  if (denominator === 0) {
    return null;
  }
  return Number((numerator / denominator).toFixed(4));
}
