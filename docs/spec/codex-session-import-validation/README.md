# Codex Session Import Risk Validation

## Purpose

This directory defines the experiments required before existing Codex Threads can
be imported as native DSH Codex Sessions. Import means creating a DSH Session shell,
binding it to the existing Codex Thread, and continuing that Thread through Codex
App Server. It does not copy or reinterpret Codex model context.

The records distinguish three independent claims:

1. Continuation: the imported DSH Session resumes and continues the original Thread.
2. Presentation: selected historical messages can be shown in native DSH views.
3. Operational safety: discovery, binding, concurrency, failure recovery, and bulk
   import remain correct.

Compaction payloads, raw response items, rollback internals, and other opaque Codex
state remain owned by Codex. They are not import mappings or release gates unless an
experiment proves that App Server cannot resume them.

## Status Vocabulary

- `not-run`: the protocol exists but has no accepted run.
- `reproduced`: the risk was observed with accepted evidence.
- `solution-designed`: a mitigation is specified but not yet verified.
- `verified`: the mitigation passed every required gate on the recorded versions.
- `unresolved`: the mitigation failed or no viable mitigation is known.
- `accepted`: the residual limitation is explicitly accepted as product behavior.

Only `verified` or `accepted` risks are closed. A result is valid only for the exact
Relay, Codex plugin, Codex CLI/App Server, and official DSH revisions in its manifest.

## Risk Register

| ID | Risk | Priority | Current status | Release gate |
| --- | --- | --- | --- | --- |
| [CSI-001](CSI-001-thread-discovery.md) | Thread discovery completeness | P0 | verified | Yes |
| [CSI-002](CSI-002-cross-entry-resume.md) | Resume Threads created by other Codex entries | P0 | verified | Yes |
| [CSI-003](CSI-003-shared-codex-store.md) | DSH and the original client use the same Codex store | P0 | verified | Yes |
| [CSI-004](CSI-004-dsh-session-creation.md) | Plugin-created DSH Session completeness | P0 | verified | Yes |
| [CSI-005](CSI-005-binding-consistency.md) | One-to-one binding and crash recovery | P0 | verified | Yes |
| [CSI-006](CSI-006-concurrent-thread-use.md) | Concurrent use from Codex and DSH | P0 | verified | Yes |
| [CSI-007](CSI-007-legacy-settings.md) | Legacy model, cwd, sandbox, and approval settings | P1 | verified | Yes |
| [CSI-008](CSI-008-history-availability.md) | Historical messages visible in DSH | P1 | verified | Product decision |
| [CSI-009](CSI-009-history-idempotency.md) | Historical projection duplication | P1 | verified | If projection ships |
| [CSI-010](CSI-010-activity-fidelity.md) | Unsupported historical activity presentation | P2 | accepted | No |
| [CSI-011](CSI-011-bulk-performance.md) | Workspace-scale import performance | P1 | verified | Yes |
| [CSI-012](CSI-012-workspace-boundary.md) | Incorrect Workspace ownership and path matching | P0 | verified | Yes |
| [CSI-013](CSI-013-missing-thread.md) | Bound Thread is archived, moved, or deleted | P1 | verified | Yes |
| [CSI-014](CSI-014-protocol-compatibility.md) | Codex App Server protocol drift | P0 | verified | Yes |

## Assessment Summary

The 2026-08-25 assessment found a viable solution for every registered risk. Thirteen
risks have a verified mitigation. CSI-010 is accepted as a bounded presentation
limitation: unknown historical activity may be omitted, but required user and assistant
messages and Codex Thread continuation remain intact.

The decisive findings are:

- `codex exec` Threads use source kind `exec`; import inventory must set
  `sourceKinds` explicitly because the App Server default omits them.
- App Server normalizes cwd values. Import must compare its returned cwd, not the raw
  path originally selected by the user.
- A 0.148 CLI Thread resumed and continued through the plugin's bundled 0.149 App
  Server, including a Thread containing `contextCompaction`.
- App Server enforces one active writer and permits resume after the prior owner exits.
- Official DSH APIs persisted, cold-resumed, and continued a Session containing
  backfilled user and assistant messages without an upstream source change.

The Workspace import feature and its safeguards are now implemented in the
production Codex plugin. Delivery acceptance, browser evidence, and per-change
reviews are tracked in `delivery-acceptance.md` and
`dsh-lab/codex-session-import/delivery-review-log.md`.

## Record Locations

Normative protocols and accepted conclusions live in this directory. Sanitized raw
evidence lives under `dsh-lab/codex-session-import/` because the DSH upstream boundary
requires compatibility probes and evidence to remain outside the specification.

The production feature's user flow, acceptance scenarios, test layers, and
per-modification review gate are defined in
[Delivery Acceptance](delivery-acceptance.md). No implementation change is accepted
without one or more mapped `CIA-*` scenarios and reproducible verification evidence.

Every run uses this layout:

```text
dsh-lab/codex-session-import/<risk-id>/<run-id>/
  manifest.json
  commands.log
  observations.jsonl
  result.md
  artifacts/
```

The evidence rules and schemas are defined in
[Experiment Protocol](experiment-protocol.md). The machine-readable status ledger is
`dsh-lab/codex-session-import/risk-register.json`.

## Release Decision

The first Workspace import release requires CSI-001 through CSI-007 and CSI-011
through CSI-014 to be `verified` or explicitly `accepted`. CSI-008 is a product gate:
if old messages must appear in native DSH Chat, CSI-008 and CSI-009 also become release
gates. CSI-010 may remain an accepted presentation limitation because unsupported
historical items do not affect Codex Thread continuation.
