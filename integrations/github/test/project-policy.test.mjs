import assert from "node:assert/strict";
import test from "node:test";

import { createGitHubPullRequestObserver } from "../src/observer.mjs";
import { authorizeProjectRepository, normalizeProjectPolicies, resolveProjectPolicy } from "../src/project-policy.mjs";
import { createPullRequestWatchProposal } from "../src/workflow.mjs";

test("EP09-002/EP11-006: project policy binds cwd, repository, scope, and observer credential without cross-project fallback", async () => {
  const policies = normalizeProjectPolicies([
    { id: "project-a", root: "/work/a", repositories: ["Octo/A"], credential: "RELAY_GITHUB_TOKEN_A" },
    { id: "project-b", root: "/work/b", repositories: ["octo/b"], credential: "RELAY_GITHUB_TOKEN_B" },
  ]);
  const projectA = resolveProjectPolicy(policies, "/work/a/packages/service");
  const projectB = resolveProjectPolicy(policies, "/work/b");
  assert.equal(projectA?.id, "project-a");
  assert.equal(projectB?.id, "project-b");
  assert.equal(resolveProjectPolicy(policies, "/work/ab"), null, "path-prefix collisions must not cross project boundaries");
  assert.equal(authorizeProjectRepository(projectA, "octo/a#7").stable_subject, "octo/a#7");
  assert.throws(() => authorizeProjectRepository(projectA, "octo/b#7"), error => error?.errorClass === "repository_not_allowed");
  assert.throws(() => authorizeProjectRepository(null, "octo/a#7"), error => error?.errorClass === "project_not_configured");

  const proposal = createPullRequestWatchProposal({
    sessionId: "session-a", pullRequest: "octo/a#7", projectScope: projectA.id, idFactory: () => "scope",
  });
  assert.equal(proposal.monitors[0].artifact.project_scope, "project-a");
  assert.doesNotMatch(JSON.stringify(proposal), /RELAY_GITHUB_TOKEN|\/work\/a/u, "durable proposal must contain only an opaque project scope");

  const calls = [];
  const clients = new Map([
    ["project-a", { async getPullRequestSnapshot() { calls.push("project-a"); return snapshot("a"); } }],
    ["project-b", { async getPullRequestSnapshot() { calls.push("project-b"); return snapshot("b"); } }],
  ]);
  const observer = createGitHubPullRequestObserver({ clientForMonitor: monitor => clients.get(monitor.artifact.project_scope) });
  const observation = await observer.observe({ monitor: proposal.monitors[0], previous: null });
  assert.equal(observation.head_sha, "sha-a");
  assert.deepEqual(calls, ["project-a"]);
  const forged = structuredClone(proposal.monitors[0]);
  forged.artifact.project_scope = "missing-project";
  await assert.rejects(observer.observe({ monitor: forged, previous: null }), error => error?.errorClass === "project_credential_unavailable");
  assert.deepEqual(calls, ["project-a"], "missing scope must fail closed instead of using another project's client");
});

test("EP11-006: malformed and duplicate project policies fail at startup", () => {
  assert.throws(() => normalizeProjectPolicies([{ root: "relative", repositories: ["o/r"], credential: "TOKEN_A" }]), /absolute root/u);
  assert.throws(() => normalizeProjectPolicies([{ root: "/a", repositories: [], credential: "TOKEN_A" }]), /repositories/u);
  assert.throws(() => normalizeProjectPolicies([{ id: "same", root: "/a", repositories: ["o/a"], credential: "TOKEN_A" },
    { id: "same", root: "/b", repositories: ["o/b"], credential: "TOKEN_B" }]), /duplicate/u);
});

function snapshot(suffix) {
  return { head_sha: `sha-${suffix}`, state: "open", merged: false, draft: false, mergeable: true, checks: [], reviews: [] };
}
