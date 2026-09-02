import assert from "node:assert/strict";
import test from "node:test";

import { installTimeAgentBridge } from "../agent-bridge.js";

test("MB05-002/MB08-004: Time owns its Session-bound convenience tool and cleanly unloads it", async () => {
  const definitions = new Map();
  let supplied;
  const dispose = installTimeAgentBridge({ tools: { register(value) {
    definitions.set(value.name, value);
    return () => definitions.delete(value.name);
  } } }, {
    sessionId: "authenticated-session",
    async scheduleTimer(input) {
      supplied = input;
      return { timer_id: "timer-1", deadline: "2026-08-30T00:30:00.000Z" };
    },
  });
  const definition = definitions.get("relay_schedule_timer");
  assert.equal("session_id" in definition.parameters.properties, false);
  await definition.execute({ task_summary: "继续", deadline: "2026-08-30T08:30:00+08:00", resume_prompt: "恢复" });
  assert.equal(supplied.sessionId, "authenticated-session");
  dispose();
  assert.equal(definitions.size, 0);
});
