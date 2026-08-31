import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// Read-only comparison of persisted first turns; never replays recorded calls.
// Usage: node compare.mjs output.json label=rollout.jsonl [...]
const [output, ...inputs] = process.argv.slice(2);
if (!output || !inputs.length) throw new Error("output.json and label=rollout.jsonl are required");
const records = [];
for (const input of inputs) {
  const separator = input.indexOf("=");
  const label = input.slice(0, separator), source = input.slice(separator + 1);
  if (separator < 1) throw new Error("Expected label=rollout.jsonl");
  const bytes = await readFile(source);
  const all = bytes.toString("utf8").split("\n").filter(Boolean).map(JSON.parse);
  const meta = all.find(x => x.type === "session_meta").payload;
  const firstStart = all.findIndex(x => x.payload?.type === "task_started");
  const firstEnd = all.findIndex((x, i) => i > firstStart && x.payload?.type === "task_complete");
  if (firstStart < 0 || firstEnd < 0) throw new Error(`${label}: first turn not complete`);
  const rows = all.slice(firstStart, firstEnd + 1);
  const context = rows.find(x => x.type === "turn_context")?.payload;
  const calls = [], results = [];
  for (const row of rows) {
    const p = row.payload;
    if (["custom_tool_call", "function_call"].includes(p.type)) {
      calls.push({ name: p.name, callId: p.call_id, timestamp: row.timestamp, input: p.input ?? p.arguments });
    }
    if (["custom_tool_call_output", "function_call_output"].includes(p.type)) {
      const text = Array.isArray(p.output) ? p.output.map(x => x.text ?? "").join("\n") : String(p.output);
      results.push({ callId: p.call_id, timestamp: row.timestamp, characters: text.length, truncated: text.includes("truncated output"),
        registry404: /(?:E404|http_status.{0,6}404|status.{0,6}404)/.test(text),
        webOpenFailure: /not safe to open|Internal Error|Cache miss/.test(text) });
    }
  }
  // Native item events preserve command outcomes independently of code-mode
  // batching. A model tool call can contain several shell commands or patches.
  const completedItems = rows.filter(x => x.payload.type === "item_completed");
  const commands = completedItems.filter(x => x.payload.item?.type === "CommandExecution")
    .map(x => ({ id: x.payload.item.id, command: x.payload.item.command,
      cwd: x.payload.item.cwd, status: x.payload.item.status,
      exitCode: x.payload.item.exit_code, stdout: x.payload.item.stdout,
      stderr: x.payload.item.stderr, startedAtMs: x.payload.started_at_ms,
      completedAtMs: x.payload.completed_at_ms }));
  const base = typeof meta.base_instructions === "string" ? meta.base_instructions : meta.base_instructions?.text ?? "";
  const final = rows.filter(x => x.payload.type === "message" && x.payload.role === "assistant")
    .flatMap(x => x.payload.content ?? []).filter(x => x.type === "output_text").map(x => x.text).at(-1);
  const tokenUsage = rows.filter(x => x.payload.type === "token_count")
    .at(-1)?.payload.info?.total_token_usage;
  records.push({ label, source, sourceSha256: hash(bytes), threadId: meta.id, cliVersion: meta.cli_version,
    historyMode: meta.history_mode, model: context?.model, effort: context?.effort,
    permissions: context?.sandbox_policy, approvalPolicy: context?.approval_policy,
    baseInstructionSha256: hash(base), startedAt: all[firstStart].timestamp, completedAt: all[firstEnd].timestamp,
    elapsedMs: Date.parse(all[firstEnd].timestamp) - Date.parse(all[firstStart].timestamp),
    recordedToolCallWallMs: results.reduce((total, result) => {
      const call = calls.find(x => x.callId === result.callId);
      return total + (call ? Date.parse(result.timestamp) - Date.parse(call.timestamp) : 0);
    }, 0),
    modelToolCalls: calls.length, modelToolResults: results.length,
    truncatedResults: results.filter(x => x.truncated).length, calls, results,
    commandExecutions: commands.length,
    failedCommandExecutions: commands.filter(c => c.status === "failed" || (c.exitCode != null && c.exitCode !== 0)).length,
    fileChanges: completedItems.filter(x => x.payload.item?.type === "FileChange").length,
    commands, tokenUsage, final });
}
await writeFile(output, JSON.stringify({ metric: "first native task_started to task_complete", records }, null, 2) + "\n");
for (const r of records) console.log(JSON.stringify({ label: r.label, seconds: r.elapsedMs / 1000,
  calls: r.modelToolCalls, truncated: r.truncatedResults, version: r.cliVersion }));
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
