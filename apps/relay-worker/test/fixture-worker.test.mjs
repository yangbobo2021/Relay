import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import { runFixtureWorker } from "../fixture-worker.mjs";

const execFileAsync = promisify(execFile);

test("fixture worker routes an email and injects it into the target conversation", async () => {
  const adapter = {
    model: "fixture-model",
    async call() {
      return {
        output: {
          disposition: "deliver",
          actionable: true,
          deliveries: [
            {
              session_id: "session-fabrikam-renewal",
              wait_ids: ["wait-fabrikam-renewal-price"],
              relation: "approves the annual renewal amount",
              confidence: 0.98,
            },
          ],
          evidence: ["annual amount and renewal approval match"],
          summary: "Fabrikam approved the renewal.",
        },
        telemetry: {
          model_calls: 1,
          latency_ms: 5,
          input_tokens: 100,
          cached_input_tokens: 0,
          output_tokens: 20,
        },
      };
    },
  };

  const result = await runFixtureWorker({
    fixtureId: "missing_thread_id_same_sender_two_topics",
    routerMode: "semantic",
    adapter,
  });

  assert.equal(result.event.state, "resolved");
  assert.equal(result.event.decision.disposition, "deliver");
  assert.equal(result.event.deliveries[0].session_id, "session-fabrikam-renewal");
  assert.equal(result.event.routing_attempts[0].usage.input_tokens, 100);
  assert.equal(result.registrations.length, 1);
  assert.equal("runs" in result.registrations[0], false);
  assert.equal(waitStatus(result.registrations[0], "wait-fabrikam-renewal-price"), "consumed");
  assert.equal(result.dispatch_results[0].status, "accepted");
});

test("worker CLI emits inspectable JSON in deterministic mode", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "apps/relay-worker/cli.mjs",
      "--fixture",
      "reply_with_reliable_thread_metadata",
      "--router",
      "expected",
      "--db",
      ":memory:",
      "--json",
    ],
    { cwd: process.cwd() },
  );
  const result = JSON.parse(stdout);

  assert.equal(result.event.state, "resolved");
  assert.equal(result.event.decision.disposition, "deliver");
  assert.equal("runs" in result.registrations[0], false);
  assert.deepEqual(result.dispatch_results[0].status, "accepted");
});

function waitStatus(session, waitId) {
  return session.waits.find((wait) => wait.wait_id === waitId)?.status;
}
