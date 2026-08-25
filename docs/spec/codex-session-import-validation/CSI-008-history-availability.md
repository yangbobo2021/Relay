# CSI-008: Historical Message Availability

## Record

- Priority: P1
- Status: verified
- Current conclusion: basic user/assistant history can be backfilled into native DSH events and cold-resumed
- Implementation status: implemented
- Accepted evidence: [2026-08-25 full assessment](../../../dsh-lab/codex-session-import/CSI-008/20260825T015012Z-full-assessment/result.md)
- Evidence root: `dsh-lab/codex-session-import/CSI-008/`

## Risk

Binding alone preserves Codex context but leaves DSH's presentation log without the
messages that occurred before import. The Session can continue correctly while native
DSH Chat appears empty or incomplete.

## Risk Reproduction

Import a synthetic multi-turn Thread using only Session creation and binding. Open it
before and after Host restart and record native Chat contents. Continue the Thread with
a question dependent on old context to keep model continuity separate from display.

Required data: redacted source turn outline, DSH event type/count inventory, screenshots,
and continuation result.

Pass condition: the experiment explicitly records whether current official DSH can
render App Server history without persisted Session events. Continuation must be
evaluated independently.

## Solution Direction

After the initial projection, observe DSH's public current-Session selection feed.
Each transition into an imported Session issues one authenticated local sync request.
The Host reads the bound Thread without resuming it and appends missing terminal
external user/assistant Turns (`completed`, `interrupted`, or `failed`) as official
DSH events. The same selection interval is
single-shot: no polling, submit hook, manual refresh, or Workspace background scan.

Codex Turn IDs are the identity boundary. Initial imported messages use deterministic
`codex:<turnId>:<role>` IDs; DSH-originated Codex Turns are recognized from persisted
assistant replay state and the adapter's durable owned-Turn ledger. Only `inProgress`
Turns are deferred until a later open.

This reconciliation is presentation backfill, not model-context migration. It uses
`thread/read`; it never resumes the source Thread merely to display history, and
opaque Codex state remains untouched.

## Solution Validation

Backfill a synthetic Thread containing plain text, reasoning summaries, images, and
unsupported items. Compare visible user/assistant message order and final text with
the source outline, then continue the same bound Thread.

Solution gate: all required terminal user and assistant messages appear in order,
interrupted and failed Turn endings retain their state, unsupported items do not block
opening, and continuation still sends only the newest DSH input.
