# CSI-012: Workspace Boundary Correctness

## Record

- Priority: P0
- Status: verified
- Current conclusion: canonical exact-cwd matching rejects child and prefix-sibling escapes while accepting aliases
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-012/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-012/`

## Risk

Naive cwd comparison can import Threads from a sibling directory, omit Threads reached
through symlinks, or cross the user's intended Workspace and permission boundary.

## Risk Reproduction

Create temporary directories for exact match, child, sibling with common prefix,
parent, symlink alias, missing target, case variant on the active filesystem, and paths
containing spaces. Associate synthetic Threads with each cwd and run inventory.

Required data: path fixture graph using placeholders, filesystem case-sensitivity,
raw and canonical cwd hashes, inclusion decisions, and rejection reasons.

Pass condition: exact and recursive Workspace policies are separately specified and
produce deterministic decisions. A common string prefix is never sufficient.

## Solution Direction

Resolve existing paths to canonical real paths, compare path components, preserve the
user-selected display path, and choose an explicit policy: MVP imports exact cwd only.
Missing or unauthorized paths remain visible only as rejected candidates.

## Solution Validation

Run the complete path matrix on case-sensitive and case-insensitive filesystems where
available. Include symlink changes between inventory and import.

Solution gate: no sibling or parent escape, deterministic symlink handling, and an
explicit diagnostic for every rejected candidate.
