import assert from "node:assert/strict";
import test from "node:test";

import { Context } from "@deepseek-ai/cordis";
import { RelayMonitorBundleRegistry } from "../../monitors/src/bundle-registry.mjs";
import { createGitHubPullRequestBundleType } from "../src/bundle-type.mjs";

test("MB06-002/004: GitHub Bundle Type is localized, health-aware, and authorization-filtered", async () => {
  const registry = new RelayMonitorBundleRegistry(new Context());
  let configured = false;
  registry.registerBundleType(createGitHubPullRequestBundleType({
    authorize: ({ cwd }) => cwd === "/work/allowed",
    availability: () => configured ? "available" : "configuration_required",
  }));
  assert.deepEqual(await registry.listBundleTypes({ authorization: { cwd: "/work/denied" } }), []);
  let [entry] = await registry.listBundleTypes({ locale: "zh-CN", authorization: { cwd: "/work/allowed" } });
  assert.equal(entry.type_id, "github.pull-request");
  assert.equal(entry.name, "GitHub 拉取请求");
  assert.equal(entry.status, "configuration_required");
  assert.deepEqual(entry.capabilities, ["github.pull-request.read"]);
  configured = true;
  [entry] = await registry.listBundleTypes({ authorization: { cwd: "/work/allowed" } });
  assert.equal(entry.status, "available");
});

test("MB06-002: registered GitHub factory creates the provider-owned proposal", async () => {
  const registry = new RelayMonitorBundleRegistry(new Context());
  registry.registerBundleType(createGitHubPullRequestBundleType());
  const type = registry.getBundleType("github.pull-request", 1);
  const proposal = await type.create({
    sessionId: "session-github", taskSummary: "等待 CI", parameters: { pull_request: "octo/relay#42" },
  });
  assert.equal(proposal.sessionId, "session-github");
  assert.equal(proposal.monitors[0].observer.provider, "github.pull-request.read");
  assert.equal(proposal.monitors[0].artifact.type_id, "github.pull-request");
  assert.equal(proposal.waits[0].expected_event, "github.pull_request.transition");
});
