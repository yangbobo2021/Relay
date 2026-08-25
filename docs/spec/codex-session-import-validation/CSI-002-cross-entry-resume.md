# CSI-002: Cross-Entry Thread Resume

## Record

- Priority: P0
- Status: verified
- Current conclusion: native resume preserves context across entries, compaction, and tested Codex versions
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-002/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-002/`

## Risk

An App Server launched by the DSH Codex plugin may discover a Thread created by Codex
CLI or Desktop but fail to resume or continue it correctly.

## Risk Reproduction

From each available Codex entry point, create a synthetic Thread containing a unique
fact, one tool operation, and at least one completed turn. For one Thread, trigger
Codex compaction naturally or with a controlled long fixture. Start the DSH-managed
App Server, call `thread/resume`, then submit a question that can only be answered from
the prior Thread context.

Required data: redacted `resume-response.json`, `continuation-result.json`, turn counts,
item-type counts, and terminal App Server status. Do not store compaction ciphertext.

Pass condition: resume succeeds, the original Thread ID is retained, the continuation
uses the synthetic prior fact, and exactly one new turn is appended. Compacted Threads
must pass without DSH inspecting their opaque state.

## Solution Direction

Use native `thread/resume` as the only continuity mechanism. Reject import when resume
fails; never synthesize a replacement Thread under the imported DSH Session.

## Solution Validation

Run two consecutive continuation turns after import, restart the plugin-managed App
Server between them, and repeat for every supported origin. Add a nonexistent Thread
ID as a negative control.

Solution gate: all supported origins survive restart and preserve context; the
negative control produces a stable, user-visible resume failure and no new binding.
