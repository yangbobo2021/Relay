# CSI-011: Bulk Import Performance

## Record

- Priority: P1
- Status: verified
- Current conclusion: metadata-only Session creation with lazy resume meets the measured scale target
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-011/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-011/`

## Risk

Listing, resuming, creating, flushing, and projecting many Sessions may stall the Host,
overload App Server, or leave a large Workspace partially imported.

## Risk Reproduction

Generate synthetic Workspaces containing 1, 10, 100, and 1,000 Thread metadata
records, plus a smaller set of real temporary App Server Threads. Measure inventory,
Session creation, persistence, UI availability, memory, CPU, and App Server requests.

Required data: one JSON metric record per run, operation counts, latency histogram,
peak memory, failure count, and imported/eligible/skipped totals.

Pass condition: the baseline identifies which operation dominates and whether eager
`thread/resume` scales linearly or causes unacceptable blocking.

## Solution Direction

Use paginated inventory and bounded concurrency. Create Session shells from list
metadata, defer `thread/resume` and optional history backfill until open, and journal
progress so cancellation and retry are safe.

## Solution Validation

Run each size at least five times with cold and warm App Server state. Include cancel
at 25%, retry, and one injected resume failure.

Solution gate: define numeric budgets before execution; the accepted result must report
median, p95, maximum, peak memory, UI blocking time, and zero duplicate Sessions.
