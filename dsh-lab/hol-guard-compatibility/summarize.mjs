import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [input, output] = process.argv.slice(2);
assert.ok(input && output, "Usage: node summarize.mjs /private/artifacts /path/evidence.json");
const names = ["dsh-control", "original-untrusted", "original-reviewed", "workspace-untrusted", "workspace-reviewed", "safe-reviewed"];
const suites = names.map(name => {
  const bytes = readFileSync(join(resolve(input), `${name}.json`));
  const report = JSON.parse(bytes);
  assert.equal(report.results.length, name === "dsh-control" ? 2 : 4, `${name}: incomplete suite`);
  const results = report.results.map(result => {
    assert.equal(result.error, undefined, `${name}/${result.name}: execution error`);
    if (result.exitCode !== undefined) assert.equal(result.exitCode, 0);
    if (result.turnStatus !== undefined) assert.equal(result.turnStatus, "completed");
    if (result.turnEnd) assert.equal(result.turnEnd.event.data.reason.kind, "completed");
    const receipts = (result.receipts?.items ?? [])
      .filter(receipt => receipt.action_envelope_json?.event_name === "PreToolUse")
      .map(receipt => ({
        id: receipt.receipt_id, timestamp: receipt.timestamp, policyDecision: receipt.policy_decision,
        approvalSource: receipt.approval_source, eventName: receipt.action_envelope_json.event_name,
        toolName: receipt.action_envelope_json.tool_name, command: receipt.action_envelope_json.command,
        preExecutionResult: receipt.action_envelope_json.pre_execution_result,
        threadId: receipt.action_envelope_json.raw_payload_redacted?.session_id,
      }));
    const hookNotifications = (result.hookNotifications ?? []).map(({ method, params }) => ({
      method, threadId: params.threadId, eventName: params.run.eventName,
      source: params.run.source, status: params.run.status, durationMs: params.run.durationMs,
      entries: params.run.entries,
    }));
    const toolText = JSON.stringify(result.toolOutputs);
    const executions = (result.toolOutputs ?? []).flatMap(output => Array.isArray(output) ? output : [{ text: String(output) }])
      .flatMap(block => {
        try { const value = JSON.parse(block.text); return Object.hasOwn(value, "exit_code") ? [value] : []; }
        catch { return []; }
      });
    const blocked = receipts.some(receipt => receipt.policyDecision === "block" && receipt.command === result.command);
    const outcome = blocked && toolText.includes("Command blocked by PreToolUse hook: HOL Guard") ? "guard-blocked"
      : result.nativeApprovals?.some(approval => approval.testResponse === "rejected") ? "native-approval-denied"
      : toolText.includes("rm -f style commands are not permitted") ? "codex-command-policy-blocked"
      : result.command.startsWith("rm ") && !result.targetExists ? "directory-deleted"
      : result.command === "printf GUARD_SAFE_COMMAND" && executions.some(item => item.exit_code === 0 && item.output === "GUARD_SAFE_COMMAND") && !blocked ? "safe-command-completed"
      : "inspect-evidence";
    return { name: result.name, command: result.command, guardVersion: result.guardVersion,
      explicitReviewedHookException: result.trustReviewedHooks ?? false, outcome,
      targetExists: result.targetExists, sentinelExists: result.sentinelExists,
      mainRequests: result.mainRequests, titleRequests: result.titleRequests,
      dshSessionId: result.sessionId, threadId: result.threadId, dshCommit: result.dshCommit,
      nativeApprovals: result.nativeApprovals,
      registeredHooks: result.registeredHooks?.data?.flatMap(entry => entry.hooks).map(hook => ({
        eventName: hook.eventName, handlerType: hook.handlerType, source: hook.source,
        enabled: hook.enabled, trustStatus: hook.trustStatus, currentHash: hook.currentHash,
      })),
      preflight: result.preflight ? ((value) => ({ status: value.status,
        controllingRuleId: value.controlling_rule_id, policyEvaluation: value.policy_evaluation,
        sideEffects: value.side_effects }))(JSON.parse(result.preflight.stdout)) : undefined,
      hookNotifications, receipts, toolOutputs: result.toolOutputs };
  });
  return { name, generatedAt: report.generatedAt, sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    codexVersion: report.codexVersion, pluginVersion: report.pluginVersion, pluginCommit: report.pluginCommit,
    model: report.model, results };
});

const get = name => suites.find(suite => suite.name === name);
for (const name of ["original-reviewed", "workspace-reviewed"]) {
  for (const result of get(name).results.filter(result => result.name !== "codex-cli-no-guard")) {
    assert.equal(result.outcome, "guard-blocked", `${name}/${result.name}`);
    assert.equal(result.targetExists, true);
    assert.equal(result.sentinelExists, true);
    if (result.name === "dsh-host") {
      assert.equal(result.mainRequests, 2);
      assert.equal(result.nativeApprovals.length, 0);
      assert.ok(result.receipts.some(receipt => receipt.threadId === result.threadId && receipt.policyDecision === "block"));
    }
    if (result.name === "relay-runtime") {
      assert.ok(result.hookNotifications.some(hook => hook.eventName === "preToolUse" && hook.status === "blocked"));
    }
  }
}
for (const result of get("original-untrusted").results) {
  assert.equal(result.outcome, result.name === "dsh-host" ? "native-approval-denied" : "codex-command-policy-blocked");
  assert.equal(result.receipts.length, 0);
  assert.equal(result.targetExists, true);
}
for (const result of get("workspace-untrusted").results) {
  assert.equal(result.outcome, "directory-deleted");
  assert.equal(result.receipts.length, 0);
}
for (const result of get("dsh-control").results) assert.equal(result.outcome, "directory-deleted");
for (const result of get("safe-reviewed").results) assert.equal(result.outcome, "safe-command-completed");
for (const name of ["original-untrusted", "workspace-untrusted"]) {
  const runtime = get(name).results.find(result => result.name === "relay-runtime");
  assert.equal(runtime.registeredHooks.length, 4);
  assert.ok(runtime.registeredHooks.every(hook => hook.enabled && hook.trustStatus === "untrusted"));
  assert.equal(runtime.hookNotifications.length, 0);
}
const evidence = { validationDate: "2026-08-31", assertionsPassed: true,
  guardInstall: "hol-guard==3.0.1, isolated venv; PyPI hashes enforced; uv pip check passed",
  trustScope: "Invocation-only --dangerously-bypass-hook-trust in fresh homes containing only reviewed Guard hooks; not persisted trust or a production recommendation",
  settings: { codexSandbox: "workspace-write", guardCustomRiskRules: false,
    cliAndRuntimeApprovalPolicy: "never", dshApprovalPolicy: "ask; test driver rejects any request and records it separately",
    guardDesktopNotifications: false, guardApprovalSurfacePolicy: "native-only", guardCloudSync: false },
  caveats: ["No external model inference: the local Responses stub emits one shell call through the advertised functions.exec tool.",
    "Title-generation requests are handled separately; DSH deny receipts must match the main conversation's Codex thread.",
    "Guard command test classifies commands without evaluating runtime policy; its review result is not a deny event.",
    "Guard events returned no lifecycle entries; actual runtime evidence comes from Guard receipts and Codex hook notifications.",
    "Does not validate persistent hook trust UI, PermissionRequest approval workflows, all tools, or other versions."], suites };
writeFileSync(resolve(output), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ assertionsPassed: true, suites: suites.length,
  scenarios: suites.reduce((count, suite) => count + suite.results.length, 0), output: resolve(output) }));
