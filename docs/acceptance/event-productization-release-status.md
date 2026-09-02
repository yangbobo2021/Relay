# Event Productization Release Status

Date: 2026-09-02

Status: **release gates passed. The candidate has local, provider-compatible,
authenticated backend-continuity, official-DSH, and controlled-live GitHub evidence.
The optional Gmail deployment certification remains pending and is disclosed below.**

Candidate branch: `codex/relay-event-productization`

Official DSH: `0.1.2-alpha.3` at
`dd6322d604e00eec1ba5e0c8541159906a21094a`, clean before and after every packed run.

## Completed Delivery Gates

| Gate | Result | Release evidence |
| --- | --- | --- |
| Full repository regression | PASS | 463 tests discovered, 463 passed, 0 failed/skipped/todo; Event package suites execute separately below |
| Event product packages | PASS | Events 52/52; Router 13/13; Monitors 13/13; GitHub 21/21; Email 20/20; real composition 16/16 |
| Backend packages | PASS | Codex 140/140 and Claude 5/5 in their standalone release verification, plus build |
| Packed package audit | PASS | Five product packages built and packed; no install scripts, private artifacts, or undeclared runtime imports |
| Operations docs | PASS | Five shell blocks, five tarballs, two healthy Doctor probes, and uninstall executed in a clean profile |
| Official DSH minimal Events | PASS | Packed Events installed; empty UI transitioned to one durable HTTP Event; duplicate/method/JSON boundaries passed |
| Official DSH management UI | PASS | English/Chinese, 1280×720/1440×900, light/dark WCAG AA, keyboard dialogs/focus, pagination, cadence persistence/validation, PR Monitor details, terminal evidence, credential lifecycles/redaction, and the user-facing fault matrix |
| Official DSH backend composition | PASS | Packed Events/Monitors/Router composed with Codex and Claude separately; client registration and Session create/open passed |
| Authenticated backend continuity | PASS | Current candidate continued one Event in the same Codex Thread and one Event in the same Claude session, with one durable Event/Delivery/Activation and one additional assistant turn per backend |
| Controlled-live GitHub polling | PASS | A root Agent armed `yangbobo2021/relay-event-acceptance-20260902#1` through `relay_watch_github_pull_request`; the packed Monitor observed a real head/check transition and produced one Event/Delivery in the existing DSH Session |
| Controlled-live GitHub webhook | PASS | GitHub redelivered a signed `pull_request.closed` request to the packed Connector with HTTP 202; Relay produced one different Event/Delivery in the same DSH Session |
| Real Codex/GitHub closed loop | PASS | Codex itself armed phase one, Relay's scheduler detected two real PR transitions, both Events continued the same Codex Thread, Codex armed phase two, and the loop completed with no live Wait or Monitor |
| Test-review integrity | PASS | Browser gates caught and held red for contrast, React event lifetime, false-visible cadence persistence, focus, label, onboarding, and fault-handling defects until fixed |

The normative index contains 158 scenarios. Provider-compatible, local protocol,
SQLite/restart/concurrency, security, package, Doctor, documentation, and browser
evidence is recorded in the package test reviews and
[`event-core-review.md`](event-core-review.md). The entry below intentionally remains
unexecuted because its provider-live evidence cannot be replaced by a fake provider or
an installation-only check. It is not a release gate.

## Pending Deployment Certification

| Scenario | Missing evidence | Action when Gmail is deployed |
| --- | --- | --- |
| EP15-011 | Real mailbox reply, authenticated Pub/Sub delivery/redelivery, and same-Session continuation | Supply a disposable Gmail mailbox plus same-project OAuth/GCP authorization and approve sending one sanitized reply; follow [`gmail-controlled-live-runbook.md`](gmail-controlled-live-runbook.md) |

## Controlled-Live GitHub Evidence

The user-authorized private repository is
`yangbobo2021/relay-event-acceptance-20260902`, PR `#1`. The repository was left open,
private, and green after the run; the temporary webhook and public tunnel were removed.

- Agent-tool polling run: fixture artifact
  `bc39cbbf7287f241a56a2f576002e5e8e95401d0590a9c281e65557f79d51514`, baseline
  `5df30a85e653a37a50d726827e080a7639c0660a`, changed head
  `ccd3aba1b90939a5c9dc465ee4f753c024378694`, Event
  `db876dae-c71f-4f97-85a6-65d5a7143ce3`, Delivery
  `1a9df918-86f0-445c-9bed-b6b0bf47dfc6`.
- Webhook run: fixture artifact
  `df47f5a61bccc234ddfb75e11b9e9da8654600f5b5963f4e39cb9e42d6b2b15f`, baseline
  `19e91725acbe84a752f01b268f985a1ddd0cdab6`, changed head
  `b81d8c14e9cb6b388620f6bd8fd3015b57160800`, polling Event/Delivery
  `fe4a29c4-9d68-4355-852e-3772e3af19ee` /
  `a68aa98d-c290-4057-ac88-69a3c163bdb2`, and webhook Event/Delivery
  `96511b7f-a70e-4756-a5d5-fd14ca8235a4` /
  `5a806d1d-f5ed-41cf-91b2-031ffcc362be`.
- Both runs installed tarballs into official DSH `0.1.2-alpha.3` and ended with
  `AUDIT_RESULT ... ok:true`. The GitHub Connector artifact was
  `6392d407921cf8a48b2f0eeee5ad61cd3a8a1d3921543ebfa0686dcf4e53033c`.
- Test review held the webhook gate red after the first GitHub delivery returned 530:
  Cloudflare QUIC and HTTP/2 edge connections were blocked. Replacing the tunnel with
  an SSH reverse tunnel and asking GitHub to redeliver the same payload yielded HTTP
  202 and the durable Event/Delivery above. Earlier verifier timeout and an invalid
  fixture accessor also failed before being corrected; neither was counted as a pass.

## Authenticated Backend Continuity Evidence

The current candidate was packed into official DSH and used the already authenticated
provider CLIs. Relay injected one trusted, exactly bound Event after the initial real
assistant turn, then waited for a second real assistant turn and compared the persisted
backend identity before and after delivery.

- Codex: DSH Session `relay-codex-event-continuity`, unchanged Thread
  `01a06159-02d9-75a0-bf81-d7f829f65e47`, Event
  `controlled-codex-event`, Delivery
  `29e53ecc-56f6-44c9-8f8c-1e946c06ad05`, Activation
  `29200be5-2c1c-478c-8121-22afb1b4d157`, assistant messages `1 → 2`, Relay inputs `1`.
- Claude: DSH Session `relay-claude-event-continuity`, unchanged provider session
  `050bebbb-7750-4469-9f8e-39cde7bc046f`, Event
  `controlled-claude-event`, Delivery
  `7338a40b-bebb-43db-9333-47686123c40b`, Activation
  `31172f90-5740-418d-8d48-b1194ea934ae`, assistant messages `1 → 2`, Relay inputs `1`.
- The fixture/Codex/Claude artifacts were respectively
  `7441044be6f32f91cb421df9fd93351a7fb8080a0e0497e14a4f3e76a84ca4d8`,
  `c4117923a9e9ce4ac21a6abe95102b10d9a6840eea90975b8bbf9b8a19a80b6d`, and
  `0013f2bbdf8d07198ae040b647a42a10737719694f65fe2b642ca69d4274d18a`.
  Both scenarios ended with `AUDIT_RESULT ... ok:true`.
- An earlier unbound fixture Event was intentionally rejected by this gate because
  semantic routing selected a different synthetic owner. The passing trace used a
  registered trusted source bound to the exact Session, Wait, version, and subject;
  the identity assertion was not weakened.

## Real Codex/GitHub Closed-Loop Evidence

The final run installed freshly packed artifacts into official DSH. Codex called the
high-level PR-watch tool itself; no test code called Relay's registration, Event,
delivery, or Monitor-check APIs. Relay's scheduler performed both checks.

- Codex Thread before/after:
  `01a06156-c590-7d43-9023-a60bfbd65e1b`.
- Phase-one Monitor `github-pr-802b9ab6-0a4a-4e27-8be1-8d7938dc1004` observed
  `3bc78b444989bc52cb130338eb2cd1a9d7c73181 → c156e0ac35f1b0a5e4708f5fe1cf66a26735286c`.
  Its Event/Delivery/Activation were
  `57d4bc4a-268b-4e59-9c0d-2bf3be685c19` /
  `0da4a3db-6b0d-4170-b849-fb619e348617` /
  `87e6b138-cc6b-463c-8286-52f48bacd964`.
- The continued Codex turn armed phase-two Monitor
  `github-pr-45410dc8-a89b-421e-bcf5-032085a2a8c3`, which observed
  `c156e0ac35f1b0a5e4708f5fe1cf66a26735286c → c2dbcef0142817163d356b97bfa213441d5c89c6`.
  Its Event/Delivery/Activation were
  `63166eac-622b-4e61-aa6f-11d68100860c` /
  `20b495f3-0b98-4304-aca2-4e92d352ff9b` /
  `43fe3ce2-1765-44b3-bcb5-746796d9e33e`.
- The run asserted exactly two Relay inputs, two different Events, two resolved
  Deliveries, no active/claimed Wait, and no active/paused/triggered/degraded Monitor.
  Fixture artifact
  `7441044be6f32f91cb421df9fd93351a7fb8080a0e0497e14a4f3e76a84ca4d8`;
  final GitHub Actions run `33611630104` passed on the restored green head.
- Test review first exposed an asynchronous preset-install race, then proved the real
  tool call returned the contract error `cadence_seconds must be 30–86400` for an
  invalid 1-second request. The final run waited for preset discovery and used the
  supported 30-second cadence; neither failed attempt was counted as passing.

The candidate now supports native Google Pub/Sub OIDC verification as well as a
trusted-gateway fixed token. Its 20/20 Email suite includes real RSA-signed JWT/JWKS,
claim/time/key failure, Host wiring, and a mutation that proves forged-signature
rejection is executing. The controlled-live command also has an executable gate that
fails before startup when any protected prerequisite is absent, so an empty environment
cannot become a false PASS. The final packed Email artifact
`02b853c9b4f7a14745409b1314d54c97d0def94981f3b4eebef868365c5badb9`
installed into official DSH and passed the authenticated shared-token HTTP/cursor smoke.
The current machine still has no Gmail OAuth credential,
Google Cloud CLI/principal, project, topic, subscription, or disposable mailbox.
Therefore EP15-011 has no provider-live PASS evidence. It remains an explicitly
pending deployment certification rather than a skipped or passing release test.

## Release Decision

This candidate satisfies the defined Event Productization release gates and may be
published. Release notes must not claim a completed real-Gmail end-to-end run. Describe
Gmail as provider-compatible and covered by packed, protocol, security, restart, UI,
and official-DSH acceptance; disclose EP15-011 as pending deployment certification.

When a real Gmail deployment is justified, EP15-011 should record a sanitized PASS
containing the provider target, candidate artifact hashes, DSH commit, Event, Delivery,
Activation, intended Session, and provider-redelivery result. Failure of that future
certification is a compatibility defect and must block promotion of the affected Gmail
deployment, not retroactively create provider-live evidence for this release.
