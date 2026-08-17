# Claude Code In Native DSH Web Specification

## Product Boundary

Claude Code is an execution backend for a normal DSH Session. It is not a second
chat application, a Desktop UI automation path, or an opaque DSH tool call.

The user creates and navigates DSH Sessions exactly as before. Selecting the
`Claude Code` Agent preset binds that DSH Session to one Claude Code session:

```text
Relay owner ID (DSH Session ID) -> Claude Code session ID
```

DSH owns navigation, title, native Chat and Trajectory views, composer, attachments
and the durable presentation log. Claude Code owns model context, tools, local
settings, skills, MCP, hooks, commands and execution. Relay owns Wait, Monitor,
Event, Delivery and Activation state. The DSH presentation log is never replayed
into Claude Code as model context.

The canonical Relay integration is the Claude Agent SDK runtime, because SDK
`canUseTool` is the supported way to pause a turn for permissions and user
questions. A Claude CLI subprocess is an acceptable fallback client when SDK
initialization is unavailable, but CLI fallback only promises structured output,
session continuation and cancellation; it must not claim full interactive approval
support. Claude Desktop and Remote Control are handoff or review surfaces only;
Relay must not rely on Desktop UI automation as the primary backend protocol.

## Session Lifecycle

- `CLS-001`: The unmodified DSH new-Session hero and Agent preset selector must list
  `Claude Code` with the other presets.
- `CLS-002`: The first normal DSH submit lazily creates exactly one Claude Code
  session with the DSH Session cwd. Concurrent first submits must not create
  duplicate Claude sessions.
- `CLS-003`: Later DSH submits continue the same Claude Code session. Only the
  newest human-authored message is sent; on a Relay activation, only the newest
  `source.plugin=relay` Event envelope is sent.
- `CLS-004`: Switching Sessions, reloading the browser and restarting the Host must
  preserve the DSH-to-Claude binding and continue Claude context when the backend can
  resume the session.
- `CLS-005`: Different DSH Sessions must never share a Claude Code session.
- `CLS-006`: Non-Claude presets and Sessions must keep their normal DSH model route
  and UI with no Claude interception.

## Native Conversation Experience

- `CLS-007`: Relay must not replace DSH's native conversation chrome for Claude Code.
- `CLS-008`: User messages, streamed assistant text, activity rows, queueing,
  cancellation and message actions use DSH's existing components and Session event
  flow.
- `CLS-009`: The existing DSH model selector must show the Claude provider, model
  and supported reasoning effort labels. The existing permission controls supply the
  Relay-side sandbox and approval policy.
- `CLS-010`: Claude tool activity must appear incrementally as compact DSH-styled
  activity rows with Claude session and turn provenance.
- `CLS-011`: DSH auxiliary calls, including automatic Session title generation and
  context compaction, must run in isolated ephemeral Claude sessions with read-only
  permissions, no project or local setting sources unless explicitly allowed, and no
  impact on the bound business session.
- `CLS-018`: Under the SDK backend, Claude tool approval requests and
  `AskUserQuestion` calls must pause the same turn, use DSH's native approval or
  question service, and return the user's allow/deny/answer to Claude before it
  continues. Under CLI fallback, requests that require a prompt may appear as
  denied tool activity instead of interactive UI.

## Relay Event Continuation

- `CLS-012`: A matched external Event creates normal Relay Event, Delivery and
  Activation records and queues a bounded, untrusted envelope in the owning DSH
  Session. DSH's normal inbox then continues the same Claude Code session.
- `CLS-013`: Busy Sessions preserve normal DSH message ordering. Relay must not
  create a parallel Claude session for an Event destined for an existing Session.
- `CLS-014`: Duplicate and unmatched Events must not start extra turns. Background
  delivery must not change the Session currently selected in DSH Web.

## Reliability And Compatibility

- `CLS-015`: Backend initialization failure, protocol error, process exit,
  unsupported request and cancellation remain explicit.
- `CLS-016`: The DSH event compatibility shim must register Claude activity events
  before cold Session load. Unknown Relay activity events must never make a
  persisted Session unloadable.
- `CLS-017`: SDK and CLI clients must implement the same Relay runtime contract:
  model catalog, create/resume session, send message, interrupt turn, release
  ephemeral session, structured activity stream and diagnostics.
