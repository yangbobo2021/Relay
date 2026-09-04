# Event Productization Specification

Status: Implemented delivery candidate; release gates passed

## Purpose

This specification defines the release boundary for making Relay useful in real
asynchronous Agent work. A release satisfying this specification can open or observe a
GitHub pull request, wait without repeated model polling, resume the same existing DSH
Session and execution-backend context on a meaningful change, and remain inspectable,
controllable, secure, bilingual, and recoverable across restarts.

The normative requirements are `EP-01` through `EP-15`. Their executable delivery
scenarios are indexed in
[`../acceptance/event-productization-scenarios.md`](../acceptance/event-productization-scenarios.md).

## Product Principles

1. Bind ownership at registration whenever a trusted source can do so. Semantic owner
   selection is reserved for genuinely unbound external input.
2. Observe cheaply and deterministically. An unchanged source state causes no model
   turn.
3. Resume with Agent-authored continuation context, not a continuation invented by a
   routing model.
4. Every accepted Event reaches an inspectable terminal disposition. Silence is not a
   failure mode.
5. DSH owns the visible Session and normal inbox ordering. Relay never creates a
   conversation in response to an Event.
6. English and Simplified Chinese are release requirements, not post-release polish.

## Shared Release Requirements

Every user-visible feature defined below must:

- render correctly at 1280x720 and 1440x900 without horizontal overflow;
- support keyboard operation, visible focus, semantic labels, and screen-reader names;
- use locale keys rather than hard-coded production UI strings;
- provide complete English (`en-US`) and Simplified Chinese (`zh-CN`) strings with no
  mixed-locale fallback in supported flows;
- present timestamps in the selected locale and timezone while retaining UTC values in
  protocol and persistence records;
- keep identifiers, source payloads, credentials, and private content out of telemetry
  and screenshots unless a sanitized fixture explicitly supplies them;
- expose an honest loading, empty, success, degraded, error, and unavailable state;
- preserve existing DSH navigation and the currently selected Session unless the user
  explicitly opens another Session.

## EP-01: Agent-Authored Wait Continuation

Each Wait may carry a versioned `continuation` containing:

- `next_action`: the first action after a matching Event;
- `success_condition`: the state that completes the current objective;
- `constraints`: bounded instructions or approval requirements;
- `artifacts`: typed references required to resume work;
- `on_failure`: handling instructions for a negative source outcome;
- `on_timeout`: handling instructions when the Wait expires.

Continuation is untrusted Agent-authored data but is not external Event content. Events
validates its shape and size, persists it atomically with the Wait, and never asks a
routing model to synthesize or rewrite it. Replacing a Wait creates a new immutable
phase-specific continuation. Historical continuation remains inspectable.

## EP-02: Complete Matched-Wait Delivery Envelope

Every delivered Event includes a bounded snapshot of each matched Wait. The snapshot
contains its identity, version, expected Event, phase, cause, ownership mode,
continuation, and typed artifacts. It also contains the routing relation and evidence
required to explain the match.

Events resolves Wait IDs into snapshots from the exact routing snapshot that was
validated at commit time. A Router returns IDs only and cannot supply authoritative
Wait content. An Activation retry reproduces the same envelope byte-for-byte except for
transport framing that is explicitly non-semantic.

## EP-03: Trusted Binding And Conflict Safety

Connectors and bound Monitors may submit a trusted binding containing a Session, Wait,
Monitor, and source-subject identity. Events accepts a binding only through a registered
trusted provider contract; the public generic Event body cannot self-assert ownership.

Validated bindings bypass semantic owner selection. Without a binding:

- one exact exclusive match is delivered;
- multiple exact non-exclusive matches may all be delivered;
- conflicting exclusive matches escalate and never depend on iteration order;
- an invalid, stale, consumed, superseded, or cross-Session binding fails closed and
  remains inspectable.

## EP-04: Production GitHub Connector

Relay provides a GitHub Connector that accepts signed webhook Events and normalizes at
least `pull_request`, `pull_request_review`, `check_run`, `check_suite`, and
`workflow_run`. It verifies the signature over the exact raw body before parsing,
bounds request size, records a stable provider identity and fingerprint, and extracts a
canonical repository, pull-request number, head revision, run/check identity, action,
and outcome.

The Connector maps trusted subjects to active bound Waits without accepting ownership
from caller-controlled JSON fields. Replayed deliveries are idempotent. Unsupported
events are acknowledged only after a durable inspectable dismissal. Secrets are stored
as secret handles or hashed verification material and are never returned after initial
configuration.

## EP-05: GitHub Pull-Request Monitor

Relay provides a trusted `github_pull_request` observer and deterministic detector. A
Monitor records a baseline and observes open/closed/merged state, head revision, draft
state, checks, review decision, and mergeability when the provider exposes them.

Canonical observations exclude volatile request metadata and use stable fingerprints.
Unchanged observations cause no Event and no model turn. A new head revision starts a
new revision epoch. Webhook and polling observations that describe the same transition
share a trigger identity. Terminal states complete the Monitor; actionable changes emit
one bound Event; provider errors use bounded backoff and visible degraded/failed states.

## EP-06: Same-Session And Same-Backend Continuity

A Delivery resolves the existing DSH Session through the Host's shared resolver and
enters its normal inbox. A Codex-backed Session continues the same bound Codex Thread;
a Claude-backed Session continues the same bound Claude session. Relay does not create,
dispose, select, or navigate conversations.

Admission is acknowledged only after durable inbox persistence. Concurrent user input
and Relay input preserve normal DSH ordering. Retry reuses the Activation message
identity and cannot append a duplicate after a crash or ambiguous acknowledgement.

## EP-07: Complete Monitor Lifecycle

Users and authenticated root Agents can create, inspect, update, pause, resume, run now,
rearm, and stop a Monitor. State includes owner, target, lifecycle, next check, last
check, last observation summary, last trigger, consecutive failure count, expiry,
budget, and terminal reason.

Tool acknowledgements distinguish a requested mutation from a durably applied state.
Target or objective changes create a new baseline epoch. Cadence-only changes preserve
the baseline. Stop retains terminal evidence. Superseding a Wait cancels its Monitor
unless the same atomic registration explicitly rearms it.

## EP-08: Visible Terminal Failure And Escalation

Routing, Connector, Monitor, Delivery, binding, Session-resolution, deadline, and
notification failures have stable error classes and bounded retry policies. An
accepted Event cannot remain indefinitely in `received`, `routing`, `dispatched`, or an
unleased retry state.

Retry exhaustion atomically commits an inspectable terminal disposition. An actionable
Event with no safe owner escalates. Escalation invokes a configured notification
provider or records a visible `notification_unavailable` result; it never fabricates a
new conversation. Monitor failure does not consume the business Wait.

## EP-09: Pull-Request Waiting Workflow

Relay provides one high-level Agent operation for watching a pull request. It resolves
the current authenticated Session and project, validates the repository and pull
request, registers a Wait with continuation, prepares a Monitor baseline, and reports
the durably armed state. The model cannot supply another Session ID.

On a trigger, the delivered continuation tells the Agent how to inspect actionable
failures, preserve approval boundaries, update the existing branch, and register the
next phase against the new head revision. The workflow never claims success merely
because a cycle or runtime cap was reached.

## EP-10: Installation, Configuration, And Doctor

Relay provides documented installation and an executable doctor for Events, Monitors,
optional Semantic Router, GitHub, storage, DSH resolver/inbox, notification provider,
and local scheduling. Doctor performs read-only or explicitly labeled disposable
probes, identifies the exact failed layer, emits machine-readable results, and exits
non-zero for release-blocking failures.

Doctor explains local-host availability limits, sleep/restart behavior, required
GitHub scopes, configured locale/timezone, and remediation without printing secrets.
Upgrade and database migration checks are part of the release path and MUST satisfy
the [Plugin Persistent Data Lifecycle](plugin-persistent-data-lifecycle.md), including
retained data after package uninstall and reinstall.

## EP-11: Unattended Security And Resource Boundaries

Webhook sources support rotation, revocation, replay resistance, request-size bounds,
and per-source rate limits. Monitors use registered trusted observers and declarative
detectors only; generated shell, unrestricted browser, arbitrary network, or mutable
customer actions remain rejected.

Every Monitor has minimum cadence, concurrency, runtime, check, provider-error, and
Event-size budgets. Connector and observer credentials are scoped to their project and
provider. Logs, audit records, UI, exported diagnostics, and test artifacts redact
secrets and private payload fields. Retention and cleanup preserve unresolved records
and terminal evidence required by policy.

## EP-12: Release-Grade Waiting And Monitor Management UI

The management surface lists current and historical Waits, Monitors, Events,
Deliveries, Activations, routing evidence, notification outcomes, and terminal reasons.
It supports open Session, check now, pause, resume, retry, cancel, and confirm stop where
the operation is available.

The UI handles pagination, concurrent refresh, stale mutations, long identifiers,
large but bounded summaries, missing providers, deleted Sessions, degraded Monitors,
and empty history. Destructive operations require an explicit confirmation that names
the target. Background completion remains visible without taking focus or navigation
from the user's active Session.

## EP-13: Durable Timer And Deadline

Relay supports an absolute UTC deadline and a positive relative delay. It stores the
resolved UTC deadline, displays it in the selected timezone, fires once when due, and
recovers overdue timers after restart. Wait deadlines can deliver a bound timeout Event
or escalate according to `continuation.on_timeout`.

Natural-language time parsing and calendar recurrence are not required. Invalid,
ambiguous, overflow, past-without-explicit-immediate, and timezone-less absolute inputs
fail before persistence.

## EP-14: Production Semantic Routing

Semantic Router processes only Events without a validated owner. It receives a bounded
snapshot of routable matching context, not authoritative persistence objects or private
continuation instructions. Its DSH model call has no tools, uses no external knowledge,
and treats Event content as untrusted evidence.

It returns `deliver`, `escalate`, or `dismiss` plus selected existing Session/Wait IDs,
relation, confidence, evidence, summary, model identity, usage, and latency. Events
validates the decision against the current snapshot and owns the atomic commit. Timeout,
cancellation, invalid output, stale candidates, and retry exhaustion cannot silently
lose the Event.

## EP-15: First Email Connector

Relay provides one production email Connector using a documented provider push/watch
or incremental-read contract. It normalizes provider message identity, sender,
recipients, subject, provider thread evidence, quoted-history summary, received time,
and bounded attachment metadata. Provider IDs and fingerprints make replay and
push/poll overlap idempotent.

Credentials remain provider-owned. Incremental cursors recover across restart and
detect invalid or expired cursors. Attachments are not executed; unsupported, encrypted,
oversized, or failed-to-summarize attachments remain visible as bounded metadata. The
Connector can route a reply semantically when correlation evidence is missing without
treating any email content as routing instructions.

Direct Google Cloud Pub/Sub delivery verifies a Google-signed OIDC JWT against cached
JWKS and exact issuer, audience, push service-account identity, verified-email, and
bounded issue/expiry claims before reading a notification body. A fixed Bearer token is
supported only when a trusted gateway owns provider authentication and injects that
credential while forwarding to Relay.

## Release Gates

A release claiming this specification must satisfy all of the following:

1. Every scenario marked `release` in the delivery acceptance index passes against
   packed artifacts, not workspace imports.
2. Official DSH compatibility is recorded with an immutable DSH commit before and
   after verification; the upstream checkout remains clean.
3. At least one real-protocol GitHub webhook replay and one real GitHub API-compatible
   Monitor flow execute through network boundaries using sanitized test resources or a
   controlled test repository.
4. Browser acceptance covers English and Simplified Chinese, keyboard-only operation,
   1280x720 layout, and browser console/network errors.
5. Restart, duplicate, concurrency, stale state, authorization, rate limit, and retry
   exhaustion are exercised with persisted state.
6. Test-review evidence demonstrates that the test executed the intended packed code,
   asserted meaningful intermediate state, failed under an injected product defect,
   and did not pass by skipping unavailable dependencies.
7. SPEC, public contracts, Agent tools, UI schemas, migrations, package README files,
   and acceptance scenarios describe the same released behavior and version.
