import assert from "node:assert/strict";
import test from "node:test";
import { installProcessAgentBridge } from "../agent-bridge.js";

test("MB07-001/MB08-004: issue tool derives owner/project and unloads cleanly", async () => {
  let definition;
  let supplied;
  const dispose = installProcessAgentBridge({ tools: { register(value) { definition = value; return () => { definition = null; }; } } }, {
    sessionId: "owner", cwd: "/work/project",
    async issueHandle(input) { supplied = input; return { handle: "opaque", identity: "h:p:s", pid: input.pid, startIdentity: "s", projectRoot: "/work/project" }; },
  });
  assert.equal("session_id" in definition.parameters.properties, false);
  assert.equal("cwd" in definition.parameters.properties, false);
  await definition.execute({ pid: 42 });
  assert.deepEqual(supplied, { pid: 42, authorization: { sessionId: "owner", cwd: "/work/project" } });
  dispose();
  assert.equal(definition, null);
});
