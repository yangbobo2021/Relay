import assert from "node:assert/strict";

const BASE_DISPOSITIONS = new Set(["deliver", "escalate", "dismiss"]);

export function validateRoutingDecision({
  decision,
  sessions,
  allowDeduplicate = false,
  canDeduplicate = false,
  label = "routing decision",
}) {
  assert.ok(decision && typeof decision === "object", `${label}: decision is required`);
  const dispositions = allowDeduplicate
    ? new Set([...BASE_DISPOSITIONS, "deduplicate"])
    : BASE_DISPOSITIONS;
  assert.ok(
    dispositions.has(decision.disposition),
    `${label}: invalid disposition ${decision.disposition}`,
  );
  assert.ok(Array.isArray(decision.deliveries), `${label}: deliveries must be an array`);

  if (decision.disposition === "deduplicate") {
    assert.ok(canDeduplicate, `${label}: deduplicate requires an existing event`);
    assert.equal(decision.deliveries.length, 0, `${label}: duplicate cannot create deliveries`);
    return decision;
  }

  assert.equal(typeof decision.actionable, "boolean", `${label}: actionable must be boolean`);
  assert.ok(Array.isArray(decision.evidence), `${label}: evidence must be an array`);
  assert.equal(typeof decision.summary, "string", `${label}: summary must be a string`);

  if (decision.disposition === "deliver") {
    assert.equal(decision.actionable, true, `${label}: delivered event must be actionable`);
    assert.ok(decision.deliveries.length > 0, `${label}: deliver requires a target`);
  } else {
    assert.equal(decision.deliveries.length, 0, `${label}: ${decision.disposition} cannot deliver`);
    assert.equal(
      decision.actionable,
      decision.disposition === "escalate",
      `${label}: actionable conflicts with ${decision.disposition}`,
    );
  }

  const sessionsById = new Map(sessions.map((session) => [session.session_id, session]));
  const deliveredSessionIds = decision.deliveries.map((delivery) => delivery.session_id);
  assertUnique(deliveredSessionIds, `${label}: delivered session IDs`);

  const selectedWaits = [];
  for (const delivery of decision.deliveries) {
    const session = sessionsById.get(delivery.session_id);
    assert.ok(session, `${label}: unknown session ${delivery.session_id}`);
    assert.ok(Array.isArray(delivery.wait_ids), `${label}: wait_ids must be an array`);
    assertUnique(delivery.wait_ids, `${label}: delivered wait IDs`);
    assert.equal(typeof delivery.relation, "string", `${label}: relation must be a string`);
    assert.ok(
      Number.isFinite(delivery.confidence) &&
        delivery.confidence >= 0 &&
        delivery.confidence <= 1,
      `${label}: confidence must be between 0 and 1`,
    );

    for (const waitId of delivery.wait_ids) {
      const wait = session.waits.find((candidate) => candidate.wait_id === waitId);
      assert.ok(wait, `${label}: wait ${waitId} does not belong to ${session.session_id}`);
      assert.equal(wait.status, "active", `${label}: wait ${waitId} is not active`);
      selectedWaits.push(wait);
    }
  }

  if (decision.deliveries.length > 1) {
    assert.ok(selectedWaits.length > 0, `${label}: multi-session delivery needs matched waits`);
    assert.ok(
      selectedWaits.every((wait) => wait.exclusive === false),
      `${label}: exclusive event cannot target multiple sessions`,
    );
  }

  return decision;
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}
