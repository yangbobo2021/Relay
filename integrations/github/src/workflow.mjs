import { randomUUID } from "node:crypto";

import { GITHUB_TRANSITION_EVENT, GitHubConnectorError } from "./contracts.mjs";
import { parsePullRequestTarget } from "./normalize.mjs";

export function createPullRequestWatchProposal({
  sessionId,
  pullRequest,
  taskSummary,
  cadenceSeconds = 60,
  continuation = {},
  projectScope = null,
  idFactory = randomUUID,
} = {}) {
  if (typeof sessionId !== "string" || !sessionId) throw new GitHubConnectorError("invalid_session", "authenticated Session is required", 400);
  if (!Number.isSafeInteger(cadenceSeconds) || cadenceSeconds < 30 || cadenceSeconds > 86_400) {
    throw new GitHubConnectorError("invalid_cadence", "GitHub cadence must be a whole number from 30 to 86400 seconds", 400);
  }
  const target = parsePullRequestTarget(pullRequest);
  const monitorId = `github-pr-${idFactory()}`;
  const waitId = `wait-${monitorId}`;
  const summary = normalizeSummary(taskSummary, `Watch ${target.stable_subject}`);
  const normalizedContinuation = {
    next_action: normalizeText(continuation.next_action, "Inspect the GitHub transition and continue the pull-request task."),
    success_condition: normalizeText(continuation.success_condition, "Required checks and review policy are satisfied."),
    constraints: normalizeArray(continuation.constraints, ["Do not merge or bypass approval without explicit authorization."]),
    artifacts: [{ kind: "github_pull_request", id: target.stable_subject, label: target.stable_subject }],
    on_failure: normalizeText(continuation.on_failure, "Inspect the failed check or requested changes, address it, push a new revision, and register the next wait."),
    on_timeout: normalizeText(continuation.on_timeout, "Report that the pull request is still waiting and include the latest known state."),
  };
  return {
    sessionId,
    taskSummary: summary,
    context: { workflow: "github_pull_request", ...target },
    waits: [{
      wait_id: waitId,
      phase: "waiting_for_pull_request",
      exclusive: true,
      exclusive_owner_key: target.stable_subject,
      expected_event: GITHUB_TRANSITION_EVENT,
      caused_by: `The Agent is waiting for a meaningful change on ${target.stable_subject}.`,
      actors: ["github"],
      entities: [target.stable_subject],
      prior_exchange: summary,
      continuation: normalizedContinuation,
    }],
    monitors: [{
      monitor_id: monitorId,
      wait_id: waitId,
      lifecycle: "one_shot",
      observer: { provider: "github" },
      detector: {
        kind: "snapshot_changed",
        fingerprint_field: "state_fingerprint",
        identity_field: "transition_key",
        correlation_key_field: "correlation_key",
        event_type: GITHUB_TRANSITION_EVENT,
      },
      schedule: { interval_seconds: cadenceSeconds, jitter_seconds: Math.min(10, Math.floor(cadenceSeconds / 10)) },
      retry: { degraded_after: 1, fail_after: 5, backoff_seconds: [60, 120, 300, 600, 900] },
      capabilities: { provider: "github", read_only: true },
      artifact: {
        kind: "trusted-provider",
        name: "github.pull_request",
        repository: target.repository,
        pull_number: target.pull_number,
        stable_subject: target.stable_subject,
        ...(projectScope ? { project_scope: projectScope } : {}),
      },
    }],
    workflow: { monitor_id: monitorId, wait_id: waitId, target },
  };
}

function normalizeSummary(value, fallback) {
  const result = normalizeText(value, fallback);
  if (result.length > 2000) throw new GitHubConnectorError("invalid_summary", "task summary is too long", 400);
  return result;
}

function normalizeText(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeArray(value, fallback) {
  if (value == null) return fallback;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) {
    throw new GitHubConnectorError("invalid_continuation", "continuation constraints must be non-empty strings", 400);
  }
  return value.map(item => item.trim());
}
