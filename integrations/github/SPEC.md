# Relay GitHub Plugin Specification

Status: Productization implementation baseline

The plugin owns signed GitHub webhook protocol handling, supported-event
normalization, GitHub pull-request read observation, and the high-level authenticated
root-Agent pull-request waiting workflow. Events owns durable Event/Wait/Delivery
state and trusted binding validation. Monitors owns baseline, leases, scheduling,
retry, and trigger commits.

## Webhook Contract

- Verify `X-Hub-Signature-256` over the exact bounded raw request body before JSON
  parsing.
- Require `X-GitHub-Delivery` and `X-GitHub-Event`; support pull request, review,
  check run, check suite, and workflow run payloads.
- Persist only bounded canonical evidence. Never persist raw headers, raw bodies, or
  secrets.
- Accept provider delivery replay idempotently and fail closed if the same identity
  carries different content.
- Resolve a trusted binding only when exactly one active Wait names the stable
  `owner/repository#number` artifact. Ambiguity uses normal Events routing and can
  never pick the first candidate.

## Observer Contract

The observer uses only read-only GitHub API requests. Canonical state includes PR
state, merge/draft/mergeable state, head SHA, sorted checks, sorted reviews, review
decision, and a stable fingerprint. Volatile HTTP metadata is excluded. Provider
errors use stable classes and never include credentials.

- Check runs and reviews follow provider pagination with hard ceilings of five
  pages and 500 items. A `next` link that leaves the configured API origin/path,
  redirects, malformed JSON, or non-JSON content fails closed without forwarding
  credentials.
- Repository move, deletion, legal unavailability, or canonical identity change
  produces a distinct durable class so the user can update policy and rearm instead
  of silently observing the wrong repository.

## Project And Credential Policy

Optional `projects` entries bind an absolute project root to an explicit repository
allowlist and credential handle. Longest path-boundary matching selects the project;
prefix collisions, an absent policy, a repository outside the allowlist, or an
unknown/forged durable `project_scope` fail closed. Monitor records persist only the
opaque policy ID—not the filesystem root, token, or credential name. Each project
client resolves only its own DSH credential handle and never falls back across
projects. Without `projects`, the legacy single-token configuration remains valid.

Webhook secrets use DSH Credentials and support current/previous overlap during
rotation. Management exposes configured/redacted state, last success/error, rotate,
and revoke; revocation rejects subsequent webhooks immediately.

## Workflow Contract

`relay_watch_github_pull_request` derives Session ownership from the authenticated
root Agent. It validates a GitHub PR target, creates versioned continuation, prepares
a baseline through Monitors, and reports success only after atomic durable
registration. Cadence is a whole number from 30 to 86400 seconds.
