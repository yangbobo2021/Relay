# GitHub Event Loop Delivery Review

Status: Provider-compatible protocol, API, project isolation, management UI, and
push/poll convergence verified. Controlled-live polling, high-level Agent arming,
signed webhook delivery, and the full two-phase Codex loop are verified against a
private disposable repository.

Official DSH: `0.1.2-alpha.3` at
`dd6322d604e00eec1ba5e0c8541159906a21094a`.

## Review A — Delivery Sufficiency

The 21 GitHub tests and real cross-plugin composition cover exact raw-body HMAC,
wrong/mutated/malformed/rotated signatures, all supported families, replay and
conflicting identity, unsupported durable dismissal, request bounds/rate, zero/one/
ambiguous binding, canonical PR/check/review state, unchanged silence, one-change
Delivery, real multi-page HTTP collection, 5-page/500-item ceilings, hostile Link
boundaries, redirect/moved/deleted/unavailable/identity-change classes, root-Agent
ownership, atomic baseline, longest project path boundary, repository allowlists,
opaque durable scopes, and per-project credential isolation.

Official DSH browser evidence adds configured/unconfigured/degraded status, secret
configure, current/previous rotation overlap, revoke, immediate post-revoke HTTP
rejection, redaction, bilingual copy, accessibility, and clean console/runtime. The
webhook-first and poll-first race uses the shared trusted correlation identity and
creates one Event/Delivery.

A real external transition was executed on
`yangbobo2021/relay-event-acceptance-20260902#1`. A root Agent called
`relay_watch_github_pull_request`, received a durable armed receipt, and the packed
Monitor observed the next GitHub head/check transition. A separate signed
`pull_request.closed` redelivery reached the packed Connector with HTTP 202. Each path
created one unique Event and Delivery in the same existing DSH Session.

The final EP09-010 run began with Codex itself calling the high-level watch tool. Two
real PR head/check transitions were detected by Relay's 30-second scheduler, not by a
forced test check. The first Event resumed the same Codex Thread and that turn armed a
second Monitor; the second Event resumed that Thread again and completed. The verifier
asserted two distinct Events, exactly two resolved Deliveries and Relay inputs, stable
Thread identity, and no residual active Wait or Monitor.

## Review B — Execution Correctness

- GitHub verification discovered 21/21 with zero skip/todo and completed packing.
- Pagination uses an actual local HTTP server, not a mocked response iterator, and
  asserts that an off-origin/path next link never receives the token.
- Project isolation tests resolve separate credential handles and prove missing or
  forged scopes do not fall back globally or to a sibling project.
- Official DSH installed packed GitHub, Events, Monitors, Router, and management
  artifacts; the browser completed secret lifecycle and a signed HTTP request through
  the running Host.
- The controlled-live run installed the same packages as tarballs into official DSH
  `0.1.2-alpha.3`, queried the real GitHub API, executed the actual root-Agent tool,
  and asserted its armed receipt, Monitor/Wait IDs, changed head SHA, Event ID,
  Delivery ID, and destination Session ID.
- GitHub recorded HTTP 202 for the successful webhook redelivery. The first attempt's
  HTTP 530 remained a failed run and exposed a blocked tunnel transport; the gate was
  rerun through a working reverse tunnel rather than weakening the assertion.
- Mutating HMAC comparison makes the invalid-signature scenario fail. Durable Event,
  Delivery, and inbox counts—not handler return values—prove idempotency and race
  convergence.
- The closed-loop gate also verifies model-originated tool calls. Its first legal run
  was held red when the model passed a 1-second cadence and Relay returned the expected
  30-second minimum error. The final run used a valid cadence and retained Monitor,
  Event, Delivery, Activation, Thread, head-SHA, and green Actions-run evidence.
