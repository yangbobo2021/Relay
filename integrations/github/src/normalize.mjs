import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { GITHUB_TRANSITION_EVENT, GitHubConnectorError } from "./contracts.mjs";

const SUPPORTED = new Set(["pull_request", "pull_request_review", "check_run", "check_suite", "workflow_run"]);

export function normalizeGitHubWebhook({ eventName, deliveryId, rawBody, payload }) {
  const providerEvent = bounded(eventName, "GitHub event name", 128);
  const sourceEventId = bounded(deliveryId, "GitHub delivery id", 256);
  assert.ok(Buffer.isBuffer(rawBody), "GitHub raw body is required");
  const fingerprint = createHash("sha256").update(rawBody).digest("hex");
  if (!SUPPORTED.has(providerEvent)) {
    return {
      source: "github",
      source_event_id: sourceEventId,
      fingerprint,
      type: "github.unsupported",
      provider_event: providerEvent,
      action: stringOrNull(payload?.action, 128),
      outcome: "unsupported",
      subject: null,
      evidence: { provider_event: providerEvent },
    };
  }

  const repository = normalizeRepository(payload?.repository?.full_name);
  const pull = resolvePull(providerEvent, payload);
  const pullNumber = positiveInteger(pull?.number ?? payload?.pull_request?.number, "pull request number");
  const headSha = bounded(
    pull?.head?.sha ?? payload?.pull_request?.head?.sha ?? payload?.check_run?.head_sha
      ?? payload?.check_suite?.head_sha ?? payload?.workflow_run?.head_sha,
    "head SHA",
    128,
  );
  const stableSubject = `${repository}#${pullNumber}`;
  const action = stringOrNull(payload?.action, 128) ?? "updated";
  const outcome = classifyOutcome(providerEvent, payload, action);
  const providerIdentity = providerObjectIdentity(providerEvent, payload);
  const occurredAt = firstTimestamp(providerEvent, payload);
  const correlationKey = githubCorrelationKey({ providerEvent, action, outcome, stableSubject, headSha, providerIdentity });
  return {
    source: "github",
    source_event_id: sourceEventId,
    fingerprint,
    type: GITHUB_TRANSITION_EVENT,
    provider_event: providerEvent,
    action,
    outcome,
    repository,
    pull_number: pullNumber,
    head_sha: headSha,
    subject: `${stableSubject}@${headSha}`,
    stable_subject: stableSubject,
    provider_identity: providerIdentity,
    correlation_key: correlationKey,
    occurred_at: occurredAt,
    evidence: {
      repository,
      pull_number: pullNumber,
      head_sha: headSha,
      provider_event: providerEvent,
      action,
      outcome,
      ...(providerIdentity ? { provider_identity: providerIdentity } : {}),
    },
  };
}

export function githubCorrelationKey({ providerEvent, action, outcome, stableSubject, headSha, providerIdentity }) {
  const prefix = `github:${stableSubject}@${headSha}`;
  if (providerEvent === "check_run") return `${prefix}:check_run:${providerIdentity ?? "unknown"}:${outcome}`;
  if (providerEvent === "pull_request_review") return `${prefix}:pull_request_review:decision:${outcome}`;
  if (providerEvent === "pull_request" && action === "closed") return `${prefix}:pull_request:state:${outcome}`;
  if (providerEvent === "pull_request" && ["synchronize", "opened"].includes(action)) return `${prefix}:pull_request:head:${headSha}`;
  if (providerEvent === "pull_request" && ["converted_to_draft", "ready_for_review"].includes(action)) return `${prefix}:pull_request:draft:${outcome}`;
  return `${prefix}:${providerEvent}:${providerIdentity ?? "unknown"}:${outcome}`;
}

export function parsePullRequestTarget(value) {
  if (value && typeof value === "object") {
    const repository = normalizeRepository(value.repository);
    const pullNumber = positiveInteger(value.pull_number ?? value.number, "pull request number");
    return { repository, pull_number: pullNumber, stable_subject: `${repository}#${pullNumber}` };
  }
  const text = bounded(value, "pull request", 2048).trim();
  const url = text.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)(?:[/?#].*)?$/iu);
  const short = text.match(/^([^/#\s]+\/[^/#\s]+)#(\d+)$/u);
  const match = url ?? short;
  if (!match) throw new GitHubConnectorError("invalid_target", "pull request must be a GitHub pull URL or owner/repository#number", 400);
  const repository = normalizeRepository(match[1]);
  const pullNumber = positiveInteger(Number(match[2]), "pull request number");
  return { repository, pull_number: pullNumber, stable_subject: `${repository}#${pullNumber}` };
}

export function stableJsonHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function resolvePull(eventName, payload) {
  if (eventName === "pull_request") return payload?.pull_request;
  if (eventName === "pull_request_review") return payload?.pull_request;
  if (eventName === "check_run") return payload?.check_run?.pull_requests?.[0];
  if (eventName === "check_suite") return payload?.check_suite?.pull_requests?.[0];
  if (eventName === "workflow_run") return payload?.workflow_run?.pull_requests?.[0];
  return null;
}

function classifyOutcome(eventName, payload, action) {
  if (eventName === "pull_request") {
    if (action === "closed") return payload.pull_request?.merged ? "merged" : "closed_unmerged";
    if (action === "converted_to_draft") return "draft";
    if (action === "ready_for_review") return "ready";
    return action;
  }
  if (eventName === "pull_request_review") return String(payload.review?.state ?? action).toLowerCase();
  if (eventName === "check_run") return String(payload.check_run?.conclusion ?? payload.check_run?.status ?? action).toLowerCase();
  if (eventName === "check_suite") return String(payload.check_suite?.conclusion ?? payload.check_suite?.status ?? action).toLowerCase();
  return String(payload.workflow_run?.conclusion ?? payload.workflow_run?.status ?? action).toLowerCase();
}

function providerObjectIdentity(eventName, payload) {
  const object = eventName === "pull_request" ? payload.pull_request
    : eventName === "pull_request_review" ? payload.review
      : eventName === "check_run" ? payload.check_run
        : eventName === "check_suite" ? payload.check_suite : payload.workflow_run;
  const id = object?.id ?? object?.node_id ?? object?.run_number;
  return id == null ? null : stringOrNull(String(id), 256);
}

function firstTimestamp(eventName, payload) {
  const object = eventName === "pull_request" ? payload.pull_request
    : eventName === "pull_request_review" ? payload.review
      : eventName === "check_run" ? payload.check_run
        : eventName === "check_suite" ? payload.check_suite : payload.workflow_run;
  return stringOrNull(object?.updated_at ?? object?.submitted_at ?? object?.completed_at ?? object?.created_at, 128);
}

function normalizeRepository(value) {
  const repository = bounded(value, "repository.full_name", 256).toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/u.test(repository)) {
    throw new GitHubConnectorError("invalid_payload", "repository.full_name is invalid", 400);
  }
  return repository;
}

function positiveInteger(value, name) {
  const number = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number <= 0) throw new GitHubConnectorError("invalid_payload", `${name} is invalid`, 400);
  return number;
}

function bounded(value, name, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new GitHubConnectorError("invalid_payload", `${name} is required and must be at most ${max} characters`, 400);
  }
  return value.trim();
}

function stringOrNull(value, max) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, max);
}
