import assert from "node:assert/strict";

export function detectMonitorEvents({ monitor, previous, current }) {
  assert.ok(current && typeof current === "object", "current observation is required");
  const detector = monitor.detector;
  if (detector.kind === "field_transition") {
    return detectFieldTransition(detector, previous, current);
  }
  if (detector.kind === "unseen_items") {
    return detectUnseenItem(detector, previous, current);
  }
  if (detector.kind === "deadline_reached") {
    return detectDeadlineReached(detector, previous, current);
  }
  throw new Error(`unsupported Monitor detector ${detector.kind}`);
}

function detectFieldTransition(detector, previous, current) {
  assert.equal(typeof detector.field, "string", "field_transition requires field");
  assert.equal(typeof detector.event_type, "string", "field_transition requires event_type");
  if (current[detector.field] !== detector.to || previous?.[detector.field] === detector.to) {
    return [];
  }
  const identityField = detector.identity_field ?? findIdentityField(current);
  const identity = identityField ? current[identityField] : detector.field;
  return [{
    type: detector.event_type,
    key: `${identity}:${current[detector.field]}`,
    data: current,
  }];
}

function detectUnseenItem(detector, previous, current) {
  assert.equal(typeof detector.identity_field, "string", "unseen_items requires identity_field");
  assert.equal(typeof detector.event_type, "string", "unseen_items requires event_type");
  const previousItems = previous?.[detector.identity_field] ?? [];
  const currentItems = current[detector.identity_field] ?? [];
  assert.ok(Array.isArray(previousItems), "previous unseen_items field must be an array");
  assert.ok(Array.isArray(currentItems), "current unseen_items field must be an array");
  const seen = new Set(previousItems);
  const item = currentItems.find((candidate) => !seen.has(candidate));
  if (item == null) {
    return [];
  }
  const prefix = detector.key_prefix ?? singularPrefix(detector.identity_field);
  return [{
    type: detector.event_type,
    key: `${prefix}:${item}`,
    data: { item_id: item, observation: current },
  }];
}

function detectDeadlineReached(detector, previous, current) {
  assert.equal(typeof detector.deadline, "string", "deadline_reached requires deadline");
  assert.equal(typeof detector.event_type, "string", "deadline_reached requires event_type");
  assert.equal(typeof current.observed_at, "string", "deadline observation requires observed_at");
  const deadline = Date.parse(detector.deadline);
  const observedAt = Date.parse(current.observed_at);
  assert.ok(Number.isFinite(deadline), "deadline_reached deadline must be an ISO timestamp");
  assert.ok(Number.isFinite(observedAt), "deadline observation observed_at must be an ISO timestamp");
  if (observedAt < deadline) {
    return [];
  }
  return [{
    type: detector.event_type,
    key: `${monitorIdentity(detector)}:${detector.deadline}`,
    data: {
      deadline: detector.deadline,
      observed_at: current.observed_at,
      resume_prompt: detector.resume_prompt,
    },
  }];
}

function monitorIdentity(detector) {
  return detector.timer_id ?? "deadline";
}

function findIdentityField(value) {
  return Object.keys(value).find((key) => key.endsWith("_id"));
}

function singularPrefix(field) {
  return field.replace(/_ids$/, "").replace(/s$/, "") || "item";
}
