# CSI-010: Historical Activity Fidelity

## Record

- Priority: P2
- Status: accepted
- Current conclusion: full internal-event fidelity is unnecessary; unknown items can degrade without blocking import
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-010/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-010/`

## Risk

Historical Codex turns may contain item types that the current DSH activity renderer
does not support. Users may mistake an incomplete activity trace for a loss of model
context or execution state.

## Risk Reproduction

Build a sanitized item corpus covering every item type returned by the supported App
Server versions. Compare live DSH projection behavior with historical backfill output
and record unknown item types without storing private payloads.

Required data: `item-type-corpus.json`, type counts, renderer decision per type,
screenshots for supported rows, and bounded redacted unknown-item shapes.

Pass condition: every observed type is classified as required message, supported
activity, intentionally hidden internal state, attachment, or unknown.

## Solution Direction

Project only user and assistant messages into DSH. Keep Codex tool, compaction,
reasoning, raw response, and unknown activity in the bound Codex Thread. Official
DSH currently has no downstream event-type registration surface, so the plugin must
not persist a private activity event merely to improve presentation.

## Solution Validation

Replay the corpus through live and historical projectors and compare normalized
presentation output. Add unknown future types as negative controls.

Solution gate: required messages remain complete, unsupported activity is omitted
without affecting continuation, every persisted event is part of official DSH's
known vocabulary, and no raw secrets, paths, or ciphertext reach DSH.
