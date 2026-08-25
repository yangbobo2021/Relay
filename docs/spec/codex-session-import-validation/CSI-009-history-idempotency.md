# CSI-009: Historical Projection Idempotency

## Record

- Priority: P1
- Status: verified
- Current conclusion: stable Thread/Turn/item provenance keys prevent duplicate and missed backfill
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-009/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-009/`

## Risk

Lazy opening, retry, restart, or repeated import may append the same historical
message more than once or omit messages added by another Codex client.

## Risk Reproduction

Run historical backfill twice, terminate it after each projected turn, restart, and
run it again. Add a new turn through another Codex client between two backfills and
exercise a source Thread whose visible history changes after rollback if supported.

Required data: source item identifiers, projection ledger snapshots, DSH event IDs and
counts after every run, and restart checkpoints.

Pass condition: the test identifies whether source item/turn IDs are stable enough to
act as projection keys and documents rollback behavior separately from continuation.

## Solution Direction

Open-time reconciliation shares the import projector but supplies a skip set containing
DSH-owned Codex Turn IDs and limits input to terminal source Turns (`completed`,
`interrupted`, or `failed`). A per-Session single-flight guard prevents duplicate
concurrent opens. After flush, reopening the same Session with an unchanged Thread
must append zero events.

The implemented provenance is append-only: imported role messages use stable
`codex:<turnId>:<role>` IDs, and DSH-originated Turn IDs are persisted in the binding
record. Source deletion and rollback mirroring are outside this delivery scope; opening
a Session never silently deletes DSH presentation events.

## Solution Validation

Repeat all retries and failure points with provenance deduplication. Compare canonical
source-message keys to DSH projection keys after each run.

Solution gate: zero duplicate message IDs, zero missing terminal external messages,
unchanged reopen appends zero events, and the owned-Turn skip set survives restart.
