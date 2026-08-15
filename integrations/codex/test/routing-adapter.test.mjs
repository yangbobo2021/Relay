import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";

import { createCodexCliRoutingAdapter } from "../routing-adapter.mjs";

test("Codex routing adapter uses an ephemeral read-only structured call", async () => {
  let invocation;
  const output = {
    disposition: "dismiss",
    actionable: false,
    deliveries: [],
    evidence: ["newsletter"],
    summary: "No task action is required.",
  };
  const adapter = createCodexCliRoutingAdapter({
    model: "test-model",
    command: "test-codex",
    async processRunner(command, args, options) {
      invocation = { command, args, options };
      await writeFile(options.outputPath, JSON.stringify(output), "utf8");
      return {
        stdout: [
          JSON.stringify({ usage: { input_tokens: 30, cached_input_tokens: 7 } }),
          JSON.stringify({ nested: { output_tokens: 4 } }),
        ].join("\n"),
        stderr: "",
      };
    },
  });

  const result = await adapter.call({ prompt: "route this", schemaPath: "/tmp/schema.json" });

  assert.deepEqual(result.output, output);
  assert.equal(invocation.command, "test-codex");
  assert.equal(invocation.options.input, "route this");
  assert.ok(invocation.args.includes("--ephemeral"));
  assert.ok(invocation.args.includes("read-only"));
  assert.deepEqual(
    invocation.args.slice(invocation.args.indexOf("--output-schema") + 1, invocation.args.indexOf("--output-schema") + 2),
    ["/tmp/schema.json"],
  );
  assert.deepEqual(result.telemetry, {
    model_calls: 1,
    latency_ms: result.telemetry.latency_ms,
    input_tokens: 30,
    cached_input_tokens: 7,
    output_tokens: 4,
  });
  assert.ok(result.telemetry.latency_ms >= 0);
});
