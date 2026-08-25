# CSI-005: Binding Consistency And Recovery

## Record

- Priority: P0
- Status: verified
- Current conclusion: deterministic reservation plus an import journal recovers every tested failure point
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-005/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-005/`

## Risk

Bulk import spans DSH Session persistence and `CodexLinkStore`. A crash can leave an
unbound Session, a binding to a missing Session, or duplicate DSH Sessions for one
Codex Thread.

## Risk Reproduction

Inject termination after each state transition: reservation, DSH Session creation,
Session flush, link write, and import completion. Restart and rerun the same import.
Also execute two concurrent imports of the same Thread.

Required data: `failure-points.json`, before/after Session inventories, redacted link
store snapshots, recovery actions, and final Thread-to-Session cardinality.

Pass condition: the unmitigated run identifies every inconsistent state and no test
can silently produce two active DSH Sessions for one Thread.

## Solution Direction

Introduce an import journal keyed by Codex Thread ID, reserve the binding before
creation, use deterministic idempotency, and reconcile incomplete records at startup.
The link store remains the runtime binding authority after commit.

## Solution Validation

Repeat every failure point and concurrent import with reconciliation enabled. Rerun
the import three times after recovery.

Solution gate: exactly one durable Session and one binding remain, retry returns that
Session, and no successfully imported Session is deleted during recovery.
