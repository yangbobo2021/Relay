import { GitHubConnectorError } from "./contracts.mjs";
import { parsePullRequestTarget, stableJsonHash } from "./normalize.mjs";

export function createGitHubPullRequestObserver({ id = "github.pull-request.read", client, clientForMonitor } = {}) {
  if (typeof client?.getPullRequestSnapshot !== "function" && typeof clientForMonitor !== "function") {
    throw new TypeError("GitHub observer requires getPullRequestSnapshot() or clientForMonitor()");
  }
  return Object.freeze({
    id,
    async observe({ monitor, previous, signal }) {
      const target = parsePullRequestTarget(monitor.artifact ?? monitor.target);
      const selected = clientForMonitor ? await clientForMonitor(monitor) : client;
      if (typeof selected?.getPullRequestSnapshot !== "function") {
        throw new GitHubConnectorError("project_credential_unavailable", "GitHub credentials are unavailable for this project");
      }
      const snapshot = await selected.getPullRequestSnapshot({ ...target, signal });
      const current = canonicalizePullRequestSnapshot(target, snapshot);
      const transition = classifyPullRequestTransition(previous, current);
      return { ...current, ...(transition ? transition : {}) };
    },
    detect: detectGitHubPullRequestEvents,
  });
}

export function detectGitHubPullRequestEvents({ monitor, previous, current }) {
  const detector = monitor?.detector;
  if (!["github.pull-request", "snapshot_changed"].includes(detector?.kind)) {
    throw new GitHubConnectorError("invalid_detector", "GitHub provider requires the GitHub pull-request detector");
  }
  if (previous == null || previous.state_fingerprint === current?.state_fingerprint) return [];
  if (typeof current?.transition_key !== "string" || typeof current?.correlation_key !== "string") {
    throw new GitHubConnectorError("malformed_observation", "GitHub transition identity is missing");
  }
  return [{
    type: "github.pull_request.transition",
    key: current.transition_key,
    data: current,
    correlation_key: current.correlation_key,
  }];
}

export function classifyPullRequestTransition(previous, current) {
  if (!previous) return null;
  const prefix = `github:${current.stable_subject}@${current.head_sha}`;
  if (previous.head_sha !== current.head_sha) {
    return { transition_kind: "head_changed", correlation_key: `${prefix}:pull_request:head:${current.head_sha}` };
  }
  if (previous.state !== current.state || previous.merged !== current.merged) {
    const outcome = current.merged ? "merged" : current.state === "closed" ? "closed_unmerged" : current.state;
    return { transition_kind: "pull_request_state", correlation_key: `${prefix}:pull_request:state:${outcome}` };
  }
  const priorChecks = new Map((previous.checks ?? []).map(check => [String(check.id), check]));
  for (const check of current.checks) {
    const prior = priorChecks.get(String(check.id));
    const outcome = check.conclusion ?? check.status;
    if (!prior || (prior.conclusion ?? prior.status) !== outcome) {
      return { transition_kind: "check_run", transition_identity: check.id, transition_outcome: outcome,
        correlation_key: `${prefix}:check_run:${check.id}:${outcome}` };
    }
  }
  if (previous.review_decision !== current.review_decision) {
    return { transition_kind: "review_decision", transition_outcome: current.review_decision,
      correlation_key: `${prefix}:pull_request_review:decision:${current.review_decision}` };
  }
  if (previous.draft !== current.draft) {
    return { transition_kind: "draft", transition_outcome: current.draft ? "draft" : "ready",
      correlation_key: `${prefix}:pull_request:draft:${current.draft ? "draft" : "ready"}` };
  }
  return { transition_kind: "snapshot", correlation_key: `${prefix}:snapshot:${current.state_fingerprint}` };
}

export function canonicalizePullRequestSnapshot(targetInput, input) {
  const target = parsePullRequestTarget(targetInput);
  if (!input || typeof input !== "object") throw new GitHubConnectorError("malformed_response", "GitHub pull request response is invalid");
  const headSha = requiredString(input.head_sha, "head_sha", 128);
  const state = oneOf(input.state, ["open", "closed"], "state");
  const checks = [...(input.checks ?? [])].map(check => ({
    id: requiredString(String(check.id), "check.id", 256),
    name: requiredString(check.name, "check.name", 512),
    status: requiredString(check.status, "check.status", 64).toLowerCase(),
    conclusion: optionalString(check.conclusion, 64)?.toLowerCase() ?? null,
    required: check.required !== false,
  })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (checks.length > 500) throw new GitHubConnectorError("response_too_large", "GitHub returned too many checks");
  const reviews = [...(input.reviews ?? [])].map(review => ({
    actor: requiredString(review.actor, "review.actor", 256),
    state: requiredString(review.state, "review.state", 64).toLowerCase(),
    submitted_at: optionalString(review.submitted_at, 128),
    commit_id: optionalString(review.commit_id, 128),
  })).filter(review => review.commit_id == null || review.commit_id === headSha)
    .sort((a, b) => a.actor.localeCompare(b.actor) || String(a.submitted_at).localeCompare(String(b.submitted_at)));
  if (reviews.length > 500) throw new GitHubConnectorError("response_too_large", "GitHub returned too many reviews");
  const core = {
    repository: target.repository,
    pull_number: target.pull_number,
    stable_subject: target.stable_subject,
    head_sha: headSha,
    state,
    merged: Boolean(input.merged),
    draft: Boolean(input.draft),
    mergeable: input.mergeable == null ? null : Boolean(input.mergeable),
    checks,
    reviews,
    review_decision: reviewDecision(reviews),
  };
  const stateFingerprint = stableJsonHash(core);
  return { ...core, state_fingerprint: stateFingerprint, transition_key: `${target.stable_subject}@${headSha}:${stateFingerprint}` };
}

function reviewDecision(reviews) {
  const latest = new Map();
  for (const review of reviews) latest.set(review.actor, review);
  const states = [...latest.values()].map(review => review.state);
  if (states.includes("changes_requested")) return "changes_requested";
  if (states.includes("approved")) return "approved";
  return "review_required";
}

function requiredString(value, name, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new GitHubConnectorError("malformed_response", `${name} is invalid`);
  return value.trim();
}

function optionalString(value, max) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, max);
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) throw new GitHubConnectorError("malformed_response", `${name} is invalid`);
  return value;
}
