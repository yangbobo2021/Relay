import assert from "node:assert/strict";
import test from "node:test";

import { GitHubApiClient } from "../src/github-api.mjs";
import { canonicalizePullRequestSnapshot, classifyPullRequestTransition, createGitHubPullRequestObserver } from "../src/observer.mjs";

test("EP05-001/002: canonical observation is stable across provider array order and volatile metadata", async () => {
  const target = { repository: "octo/relay", pull_number: 42 };
  const input = {
    head_sha: "abc", state: "open", merged: false, draft: false, mergeable: true,
    request_id: "volatile-a",
    checks: [
      { id: 2, name: "test", status: "completed", conclusion: "success" },
      { id: 1, name: "lint", status: "completed", conclusion: "success" },
    ],
    reviews: [
      { actor: "zoe", state: "approved", submitted_at: "2026-01-02T00:00:00Z", commit_id: "abc" },
      { actor: "amy", state: "changes_requested", submitted_at: "2026-01-01T00:00:00Z", commit_id: "abc" },
    ],
  };
  const first = canonicalizePullRequestSnapshot(target, input);
  const second = canonicalizePullRequestSnapshot(target, {
    ...input,
    request_id: "volatile-b",
    checks: [...input.checks].reverse(),
    reviews: [...input.reviews].reverse(),
  });
  assert.deepEqual(second, first);
  assert.equal(first.review_decision, "changes_requested");
  assert.equal(first.checks[0].name, "lint");

  const observer = createGitHubPullRequestObserver({ client: { async getPullRequestSnapshot() { return input; } } });
  const observed = await observer.observe({ monitor: { artifact: { kind: "trusted-provider", name: "github.pull_request", ...target } } });
  assert.equal(observed.state_fingerprint, first.state_fingerprint);
});

test("EP05-006: new head SHA creates a distinct revision fingerprint", () => {
  const target = { repository: "octo/relay", pull_number: 42 };
  const common = { state: "open", merged: false, draft: false, mergeable: null, checks: [], reviews: [] };
  const oldRevision = canonicalizePullRequestSnapshot(target, { ...common, head_sha: "old" });
  const newRevision = canonicalizePullRequestSnapshot(target, { ...common, head_sha: "new" });
  assert.notEqual(oldRevision.state_fingerprint, newRevision.state_fingerprint);
  assert.match(newRevision.transition_key, /@new:/u);
});

test("EP04-005/EP05-010: polling and webhook check transitions share one canonical correlation key", () => {
  const target = { repository: "octo/relay", pull_number: 42 };
  const previous = canonicalizePullRequestSnapshot(target, {
    head_sha: "abc", state: "open", merged: false, draft: false, mergeable: true,
    checks: [{ id: "check-1", name: "test", status: "in_progress", conclusion: null }], reviews: [],
  });
  const current = canonicalizePullRequestSnapshot(target, {
    head_sha: "abc", state: "open", merged: false, draft: false, mergeable: true,
    checks: [{ id: "check-1", name: "test", status: "completed", conclusion: "failure" }], reviews: [],
  });
  assert.equal(classifyPullRequestTransition(previous, current).correlation_key,
    "github:octo/relay#42@abc:check_run:check-1:failure");
});

test("EP05-003/004/005/007: check, review, draft, and terminal transitions classify deterministically", () => {
  const target = { repository: "octo/relay", pull_number: 42 };
  const make = overrides => canonicalizePullRequestSnapshot(target, {
    head_sha: "abc", state: "open", merged: false, draft: false, mergeable: true,
    checks: [{ id: "required", name: "Required", status: "in_progress", conclusion: null, required: true }],
    reviews: [], ...overrides,
  });
  const baseline = make({});
  assert.deepEqual(classifyPullRequestTransition(baseline, make({
    checks: [{ id: "required", name: "Required", status: "completed", conclusion: "failure", required: true }],
  })), {
    transition_kind: "check_run", transition_identity: "required", transition_outcome: "failure",
    correlation_key: "github:octo/relay#42@abc:check_run:required:failure",
  });
  assert.equal(classifyPullRequestTransition(baseline, make({
    checks: [{ id: "required", name: "Required", status: "completed", conclusion: "success", required: true }],
  })).transition_outcome, "success");
  assert.equal(classifyPullRequestTransition(baseline, make({
    reviews: [{ actor: "reviewer", state: "changes_requested", submitted_at: "2026-01-01T00:00:00Z", commit_id: "abc" }],
  })).transition_outcome, "changes_requested");
  assert.equal(classifyPullRequestTransition(baseline, make({ draft: true })).transition_outcome, "draft");
  assert.equal(classifyPullRequestTransition(baseline, make({ state: "closed", merged: false })).correlation_key,
    "github:octo/relay#42@abc:pull_request:state:closed_unmerged");
  assert.equal(classifyPullRequestTransition(baseline, make({ state: "closed", merged: true })).correlation_key,
    "github:octo/relay#42@abc:pull_request:state:merged");
});

test("EP05-005/006: reviews from an old SHA cannot approve the current revision", () => {
  const target = { repository: "octo/relay", pull_number: 42 };
  const current = canonicalizePullRequestSnapshot(target, {
    head_sha: "new", state: "open", merged: false, draft: false, mergeable: true, checks: [],
    reviews: [
      { actor: "old-reviewer", state: "approved", submitted_at: "2026-01-01T00:00:00Z", commit_id: "old" },
      { actor: "current-reviewer", state: "changes_requested", submitted_at: "2026-01-02T00:00:00Z", commit_id: "new" },
    ],
  });
  assert.equal(current.reviews.length, 1);
  assert.equal(current.reviews[0].actor, "current-reviewer");
  assert.equal(current.review_decision, "changes_requested");
});

test("EP05-008: GitHub API errors are stable and never expose the token", async () => {
  const secret = "TOKEN-SHOULD-NOT-LEAK";
  for (const [status, errorClass, remaining] of [
    [301, "repository_moved"], [401, "authentication"], [403, "permission", "1"], [403, "rate_limited", "0"],
    [404, "not_found"], [410, "repository_deleted"], [429, "rate_limited"], [451, "repository_unavailable"], [503, "provider_unavailable"],
  ]) {
    const client = new GitHubApiClient({ token: secret, fetchImpl: async (_url, request) => {
      assert.equal(request.headers.authorization, `Bearer ${secret}`);
      return fakeResponse(status, {}, remaining);
    } });
    await assert.rejects(client.get("/fixture"), error => {
      assert.equal(error.errorClass, errorClass);
      assert.ok(!error.message.includes(secret));
      return true;
    });
  }
  const network = new GitHubApiClient({ token: secret, fetchImpl: async () => { throw new Error(secret); } });
  await assert.rejects(network.get("/fixture"), error => error.errorClass === "network_error" && !error.message.includes(secret));

  const movedIdentity = new GitHubApiClient({ fetchImpl: async () => fakeResponse(200, {
    head: { sha: "sha" }, base: { repo: { full_name: "new-owner/new-name" } },
  }) });
  await assert.rejects(
    movedIdentity.getPullRequestSnapshot({ repository: "old-owner/old-name", pull_number: 1 }),
    error => error.errorClass === "repository_identity_changed",
  );
});

function fakeResponse(status, body, remaining) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) {
      if (name === "content-type") return "application/json";
      if (name === "x-ratelimit-remaining") return remaining ?? null;
      return null;
    } },
    async json() { return body; },
  };
}
