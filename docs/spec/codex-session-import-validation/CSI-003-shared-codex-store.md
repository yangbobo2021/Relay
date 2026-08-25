# CSI-003: Shared Codex Store Identity

## Record

- Priority: P0
- Status: verified
- Current conclusion: solvable by pinning and fingerprinting the effective Codex profile/store
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-003/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-003/`

## Risk

The DSH-managed App Server may use a different Codex profile, account, or storage root
from the client that created the old Thread. Discovery then appears empty or resume
fails even though the Thread exists elsewhere on the same machine.

## Risk Reproduction

Create two isolated temporary Codex profiles, each with a distinct synthetic Thread.
Launch the plugin-managed App Server once per profile and query both Thread IDs.
Record the effective profile source, process environment allowlist, and discovery
results without recording credentials or absolute home paths.

Required data: `profile-matrix.json`, redacted process configuration, Thread-ID hashes,
and `thread/list`/`thread/resume` outcomes.

Pass condition: the selected profile sees only its own Threads, and the plugin can
deterministically identify which profile it is using before import.

## Solution Direction

Inherit the normal Codex profile selection used by the installed Codex client. Expose
a non-sensitive store identity fingerprint and block import when inventory and resume
are executed against different identities.

## Solution Validation

Switch profiles between inventory and import and verify that the plugin detects the
mismatch. Repeat without an explicit override to verify the normal user profile is
selected consistently across Host restarts.

Solution gate: no cross-profile false import, deterministic mismatch diagnostics, and
stable store identity across two restarts.
