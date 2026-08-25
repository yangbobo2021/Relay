# CSI-001: Thread Discovery Completeness

## Record

- Priority: P0
- Status: verified
- Current conclusion: solvable with explicit source filters, pagination, and canonical cwd matching
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-001/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-001/`

## Risk

`thread/list` may omit importable Threads because of source filtering, pagination,
archival state, cwd representation, or client origin. A false negative makes an old
conversation unavailable for import.

## Risk Reproduction

Create a temporary Workspace and synthetic Threads from Codex CLI, Codex Desktop when
available, and DSH. Include more Threads than one response page, one archived Thread,
one ephemeral Thread, a nested cwd, and a Workspace alias through a symbolic link.
Call `thread/list` with and without `cwd`, traverse all returned pages, and record the
returned IDs, source, cwd, archival state, and pagination tokens.

Required data: `created-threads.json`, `list-pages.jsonl`, `discovery-matrix.csv`, and
RPC timings in the run manifest.

Pass condition: every non-ephemeral Thread whose canonical cwd matches the selected
Workspace is returned exactly once; excluded Threads are explained by a documented
rule. No plugin-side `threadSource` filter hides an otherwise importable Thread.

## Solution Direction

Add a dedicated import inventory path that follows App Server pagination, accepts all
supported non-ephemeral sources, canonicalizes cwd for comparison, and reports
archived Threads separately. Keep the existing runtime-session filter independent.

## Solution Validation

Repeat the matrix through the plugin import inventory API. Compare its output against
the independently recorded created-Thread set. Inject duplicate pages and a missing
pagination token in a fake App Server fixture.

Solution gate: 100% recall and no duplicates for eligible Threads; malformed
pagination fails explicitly and does not return a silently incomplete inventory.
