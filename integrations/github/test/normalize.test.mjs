import assert from "node:assert/strict";
import test from "node:test";

import { normalizeGitHubWebhook, parsePullRequestTarget } from "../src/normalize.mjs";

const base = {
  repository: { full_name: "Octo/Relay" },
  pull_request: { number: 42, head: { sha: "abc123" }, updated_at: "2026-01-01T00:00:00Z" },
};

test("EP04-002: supported GitHub event matrix normalizes stable PR evidence", () => {
  const fixtures = [
    ["pull_request", { ...base, action: "closed", pull_request: { ...base.pull_request, merged: true } }, "merged"],
    ["pull_request_review", { ...base, action: "submitted", review: { id: 8, state: "approved", submitted_at: "2026-01-01T00:00:00Z" } }, "approved"],
    ["check_run", { repository: base.repository, action: "completed", check_run: { id: 9, head_sha: "abc123", conclusion: "failure", pull_requests: [{ number: 42, head: { sha: "abc123" } }] } }, "failure"],
    ["check_suite", { repository: base.repository, action: "completed", check_suite: { id: 10, head_sha: "abc123", conclusion: "success", pull_requests: [{ number: 42, head: { sha: "abc123" } }] } }, "success"],
    ["workflow_run", { repository: base.repository, action: "completed", workflow_run: { id: 11, head_sha: "abc123", conclusion: "cancelled", pull_requests: [{ number: 42, head: { sha: "abc123" } }] } }, "cancelled"],
  ];
  for (const [eventName, payload, outcome] of fixtures) {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const result = normalizeGitHubWebhook({ eventName, deliveryId: `delivery-${eventName}`, rawBody, payload });
    assert.equal(result.source, "github");
    assert.equal(result.type, "github.pull_request.transition");
    assert.equal(result.repository, "octo/relay");
    assert.equal(result.pull_number, 42);
    assert.equal(result.head_sha, "abc123");
    assert.equal(result.stable_subject, "octo/relay#42");
    assert.equal(result.outcome, outcome);
    assert.match(result.correlation_key, /^github:octo\/relay#42@abc123:/u);
    assert.match(result.fingerprint, /^[a-f0-9]{64}$/u);
    assert.ok(!JSON.stringify(result).includes("sender"));
  }
});

test("EP04-006: a signed unknown family can be durably dismissed without provider payload", () => {
  const payload = { action: "published", repository: { full_name: "private/name" }, secret_body: "must-not-persist" };
  const result = normalizeGitHubWebhook({ eventName: "release", deliveryId: "delivery-release", rawBody: Buffer.from(JSON.stringify(payload)), payload });
  assert.equal(result.type, "github.unsupported");
  assert.equal(result.outcome, "unsupported");
  assert.ok(!JSON.stringify(result).includes("must-not-persist"));
});

test("EP09-003: target parser accepts canonical GitHub forms and rejects foreign URLs", () => {
  assert.deepEqual(parsePullRequestTarget("https://github.com/Octo/Relay/pull/42"), {
    repository: "octo/relay", pull_number: 42, stable_subject: "octo/relay#42",
  });
  assert.deepEqual(parsePullRequestTarget("octo/relay#42"), {
    repository: "octo/relay", pull_number: 42, stable_subject: "octo/relay#42",
  });
  assert.throws(() => parsePullRequestTarget("https://example.com/octo/relay/pull/42"), /GitHub pull URL/);
});
