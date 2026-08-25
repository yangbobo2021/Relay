# CSI-013: Missing Or Unavailable Bound Thread

## Record

- Priority: P1
- Status: verified
- Current conclusion: archive, unarchive, profile mismatch, and deletion can be handled without silent replacement
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-013/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-013/`

## Risk

After import, the original Codex Thread may be archived, moved to another profile, or
deleted. The DSH Session can remain visible while its authoritative context is gone.

## Risk Reproduction

Import synthetic active and archived Threads. After binding, archive, unarchive,
remove, or hide each Thread through supported Codex operations and profile switching.
Open the DSH Session and attempt a continuation after each transition.

Required data: lifecycle transition log, list/resume results, DSH visible state,
binding snapshot, and count of newly created Threads.

Pass condition: every unavailable state is distinguishable where App Server permits,
and current code never silently creates a replacement Thread after an import resume
failure.

## Solution Direction

Persist imported provenance and treat resume failure as a broken binding. Keep the DSH
Session and presentation log, provide explicit retry/relink diagnostics, and require a
separate user decision before starting a new Thread.

## Solution Validation

Repeat all transitions, including recovery by unarchiving or restoring the correct
profile. Verify subsequent continuation uses the original Thread ID.

Solution gate: zero silent replacement Threads, recoverable states resume correctly,
and permanent loss remains explicit without corrupting the DSH Session.
