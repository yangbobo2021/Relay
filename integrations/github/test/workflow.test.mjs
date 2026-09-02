import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPullRequestWatchProposal } from "../src/workflow.mjs";

test("EP09-001/EP01-001: PR workflow creates one bound Wait, complete continuation, and trusted Monitor", () => {
  const proposal = createPullRequestWatchProposal({
    sessionId: "session-authenticated",
    pullRequest: "https://github.com/Octo/Relay/pull/42",
    taskSummary: "Wait for CI and review",
    cadenceSeconds: 90,
    continuation: { next_action: "Inspect the transition.", constraints: ["Keep approval boundaries."] },
    idFactory: () => "fixed",
  });
  assert.equal(proposal.sessionId, "session-authenticated");
  assert.equal(proposal.waits.length, 1);
  assert.equal(proposal.monitors.length, 1);
  assert.equal(proposal.waits[0].wait_id, proposal.monitors[0].wait_id);
  assert.equal(proposal.waits[0].expected_event, "github.pull_request.transition");
  assert.equal(proposal.waits[0].continuation.next_action, "Inspect the transition.");
  assert.deepEqual(proposal.waits[0].continuation.artifacts, [{ kind: "github_pull_request", id: "octo/relay#42", label: "octo/relay#42" }]);
  assert.equal(proposal.monitors[0].observer.provider, "github.pull-request.read");
  assert.equal(proposal.monitors[0].detector.kind, "github.pull-request");
  assert.equal(proposal.monitors[0].artifact.stable_subject, "octo/relay#42");
  assert.equal(proposal.monitors[0].schedule.interval_seconds, 90);
});

test("EP09-003/EP11-004: invalid cadence and target fail before any persistence call", () => {
  for (const cadenceSeconds of [0, 29, 30.5, 86_401, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createPullRequestWatchProposal({ sessionId: "s", pullRequest: "octo/relay#42", cadenceSeconds }), /cadence/);
  }
  assert.throws(() => createPullRequestWatchProposal({ sessionId: "s", pullRequest: "gitlab.com/o/r#1" }), /GitHub pull URL/);
});

test("EP09-002: host attaches the workflow only to roots and Agent tool has no Session argument", async () => {
  const host = await readFile(new URL("../host-plugin.js", import.meta.url), "utf8");
  const bridge = await readFile(new URL("../agent-bridge.js", import.meta.url), "utf8");
  assert.match(host, /agents\.roots\(\)\.includes\(agent\)/u);
  assert.match(host, /sessionId: agent\.id/u);
  const parameters = bridge.slice(bridge.indexOf("parameters:"), bridge.indexOf("output:"));
  assert.doesNotMatch(parameters, /session_id|sessionId/u);
  assert.match(bridge, /sessionId,/u);
});
