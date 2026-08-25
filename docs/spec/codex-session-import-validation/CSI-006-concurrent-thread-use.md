# CSI-006: Concurrent Thread Use

## Record

- Priority: P0
- Status: verified
- Current conclusion: App Server enforces one process-level active writer, switching UI Sessions does not reliably release it, no force-takeover parameter exists, and takeover succeeds after owner-process exit
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-006/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-006/`

## Risk

Codex Desktop, CLI, and DSH may submit, interrupt, approve, or update settings on the
same Thread concurrently, producing ambiguous ordering or cross-client interference.

## Risk Reproduction

Bind one synthetic Thread to DSH. Start a long-running turn from one client, then
attempt submit, interrupt, approval response, and settings update from the other.
Repeat with the clients reversed and with two nearly simultaneous idle submissions.

Required data: timestamped RPC trace, turn IDs and statuses, notification ordering,
final Thread turn order, and each client's visible error or queue state.

Pass condition: App Server behavior is deterministic and observable. No input is
silently dropped, attached to the wrong turn, or reported successful when rejected.

## Solution Direction

Prefer App Server's native admission semantics. `thread/list` and `thread/read` do
not expose another client's writer ownership, and `thread/resume` has no force or
takeover parameter, so preflight disabling is unavailable. Classify the resume
failure as `CODEX_THREAD_ACTIVE_WRITER`, mark it retryable, explain that switching UI
Sessions may not release the process-level writer, tell the user to fully quit or
restart the owning Codex app, CLI, or App Server process, preserve the one-to-one
binding, and retry native resume on the next submit. Never infer safety solely from
DSH Session status and never silently fork, replace the Thread, or terminate another
client.

## Solution Validation

Repeat the contention matrix with the guard enabled, including Host restart during an
active external turn. Verify the stable error contract, no `thread/start`, and that a
second submit resumes the same Thread after the owning process exits. Separately
observe the writer-lock owner before and after a Codex UI Session switch.

Solution gate: deterministic queue or rejection behavior, correct cancellation
ownership, and no permanent lock after restart.
