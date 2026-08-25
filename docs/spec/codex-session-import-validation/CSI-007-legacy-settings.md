# CSI-007: Legacy Thread Settings

## Record

- Priority: P1
- Status: verified
- Current conclusion: solvable with read-only resume, cwd validation, and explicit model fallback
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-007/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-007/`

## Risk

An imported Thread may reference an unavailable model, moved cwd, unsupported
reasoning effort, or obsolete sandbox and approval settings. Applying current DSH
controls may also unintentionally alter the old Thread before the user submits.

## Risk Reproduction

Create fixtures for an available model, an unknown model ID, a moved Workspace, each
supported sandbox, and each approval policy. Inventory and resume each Thread without
sending a turn, then send one controlled turn under explicitly selected DSH settings.

Required data: settings before inventory, after resume, before submit, and after
submit; model-list snapshot; cwd existence state; and App Server errors.

Pass condition: inventory and opening are read-only. Unsupported settings are detected
before submit, and the effective settings for the continuation are explicit.

## Solution Direction

Preserve the Thread during discovery and resume. Initialize DSH controls from supported
Thread settings where available; otherwise select a documented current fallback and
require a visible choice before the first continuation. Reject missing or unauthorized
cwd rather than silently substituting another Workspace.

## Solution Validation

Repeat the matrix after normalization and fallback logic. Verify `thread/settings/update`
is sent only when the user-approved effective settings differ.

Solution gate: no mutation before submit, no hidden cwd replacement, and every new
turn records the intended model, effort, sandbox, and approval behavior.
