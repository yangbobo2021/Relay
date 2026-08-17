# Codex In Native DSH Web Specification

## Product Boundary

Codex is an execution backend for a normal DSH Session. It is not a second chat
application, a full-page slot replacement, or an opaque DSH tool call.

The user creates and navigates DSH Sessions exactly as before. Selecting the `Codex`
Agent preset binds that DSH Session to one Codex Thread:

```text
Relay owner ID (DSH Session ID) -> Codex Thread ID
```

DSH owns navigation, title, native Chat and Trajectory views, composer, attachments and
the durable presentation log. Codex owns model context and execution. Relay owns
Wait, Monitor, Event, Delivery and Activation state. The DSH presentation log is
never replayed into Codex as model context. Their default visibility follows the
[conversation presentation specification](conversation-presentation.md).

## Session Lifecycle

- `CXS-001`: The unmodified DSH new-Session hero and Agent preset selector must list
  `Codex` with the other presets. Selecting it must not replace or hide the hero, so
  the user can switch presets until the first message locks the Session.
- `CXS-002`: The first normal DSH submit lazily creates exactly one Codex Thread with
  the Session cwd. Concurrent first submits must not create duplicate Threads.
- `CXS-003`: Every later DSH submit starts a turn on the same Thread. Only the newest
  human-authored message is sent; on a Relay activation, only the newest
  `source.plugin=relay` Event envelope is sent. Other DSH system/context injections
  are not duplicated into the Codex prompt.
- `CXS-004`: Switching Sessions, reloading the browser, and restarting the Host must
  preserve the DSH-to-Thread binding and continue Codex context.
- `CXS-005`: Different DSH Sessions must never share a Codex Thread. A missing Thread
  may be replaced only after an explicit resume failure is recorded.
- `CXS-006`: Non-Codex presets and Sessions must keep their normal DSH model route and
  UI with no Codex interception.

## Native Conversation Experience

- `CXS-007`: Relay must not replace `conversation.session`,
  `conversation.session.header`, `conversation.view`, `conversation.composer`, or
  `conversation.hero.agentPreset` for Codex.
- `CXS-008`: User messages, streamed reasoning summaries, commentary, final answers,
  title, Chat and Trajectory projections, queueing, cancel, attachments and message
  actions use DSH's existing components and Session event flow. Diagnostic visibility
  follows `CPS-001` through `CPS-006`.
- `CXS-009`: The existing DSH model selector must show the Codex provider, model and
  supported reasoning efforts. Before a later turn starts, Relay must synchronize any
  changed model, reasoning effort and multi-agent mode to the bound Codex Thread with
  the native `thread/settings/update` App Server method; the following `turn/start`
  keeps `model`, `effort` and `serviceTier` null and carries the effective values in
  `collaborationMode.settings`. The existing permission control supplies sandbox and
  approval policy. No duplicate Codex composer controls are allowed.
- `CXS-010`: Codex command, file, MCP, dynamic-tool, web, plan and collaboration items
  must appear incrementally as compact DSH-styled activity rows. Relay may add only
  item-level renderers for facts DSH cannot otherwise express.
- `CXS-011`: Activity rows must survive Session switching, browser reload and Host
  restart. They are presentation-only and must not enter Codex model context.
- `CXS-012`: Codex-generated images must be imported into DSH's attachment store and
  rendered by the native assistant image gallery. Local paths and base64 must not be
  exposed in the browser event payload.
- `CXS-013`: Codex command/file/permission approvals must use DSH's native approval
  interaction. Codex user-input requests must use DSH's native question interaction.
  No request may be silently approved.
- `CXS-014`: App Server notifications must be pushed into the active DSH stream and
  Session log. Polling a parallel Codex snapshot or requiring page reload is not an
  acceptable product path.
- `CXS-024`: DSH auxiliary model calls, including automatic Session title generation
  and context compaction, must never run on the Session's bound Codex Thread. Each
  call uses an unlinked ephemeral Thread with read-only sandbox, `never` approval,
  no Relay dynamic tools and purpose-scoped instructions. Auxiliary output returns
  only to the owning DSH service and must not append conversation activity. Failure
  retains DSH's native deterministic fallback and cannot replace the business answer.
- `CXS-025`: A persisted Codex activity row must expose read-only App Server
  provenance, including its bound Thread and Turn identifiers, without adding a
  debug panel or replacing native DSH conversation chrome.
- `CXS-026`: Relay may expose native Codex App dynamic tools only when the Relay/DSH
  Host can truthfully execute equivalent behavior. The supported `codex_app` parity
  surface is currently `load_workspace_dependencies`, which is read-only and returns
  the bundled workspace runtime paths. `automation_update`, `open_in_codex`,
  `navigate_to_codex_page`, and `read_thread_terminal` are intentionally not declared
  until Relay has real Host implementations. The Relay-specific
  `relay_wait_for_event` and `relay_cancel_waits` tools remain separately injected.

## Relay Event Continuation

- `CXS-015`: Waits are created by Session agent capabilities or external integrations,
  not by a manual control embedded in the conversation. Users inspect/cancel waits in
  the existing Relay settings section.
- `CXS-016`: A matched external Event creates normal Relay Event, Delivery and
  Activation records and queues a bounded, untrusted envelope in the owning DSH
  Session. DSH's normal inbox then continues the same Codex Thread. It must not create
  a Codex Automation, DSH timer, cron job or Relay Monitor.
- `CXS-017`: Durable acceptance by the owning DSH inbox is the Delivery boundary.
  Busy Sessions preserve normal DSH message ordering instead of starting a parallel
  Codex turn; failures before durable acceptance retain the Activation for retry.
- `CXS-018`: Duplicate and unmatched Events must not start extra turns. Background
  delivery must not change the Session currently selected in DSH Web.
- `CXS-019`: Production UI and public remotes must contain no `xx.completed`, manual
  wait/register, or manual event-trigger test controls.
- `CXS-020`: DSH Web must expose a real external Event ingress at
  `POST /api/relay/events`. It accepts JSON Events only, returns durable Relay
  Event/Delivery state, permits loopback callers, and requires a configured bearer
  token for non-loopback callers. Ingress must call the same Relay runtime used by
  the DSH inbox; it must not emulate delivery or expose a browser test endpoint.

## Reliability And Compatibility

- `CXS-021`: App Server timeout, protocol error, process exit, unsupported request and
  failed image import remain explicit; cancellation must terminate the Codex turn.
- `CXS-022`: The DSH event compatibility shim must be installed before cold Session
  load and verified against the pinned DSH revision. Unknown Relay activity events
  must never make a persisted Session unloadable.
- `CXS-023`: Desktop and compact mobile views must preserve the native DSH layout with
  no overlapping controls, nested conversation cards, or page-wide replacement.

## Acceptance Boundary

Deterministic tests use a fake App Server and real Relay persistence. Browser
acceptance uses the native DSH Web app and covers new Session preset switching,
multi-turn continuity, Session switching, restart recovery, streamed reasoning and
tools, generated images, native approval/question routing, and Relay Event
continuation. It also verifies that automatic title generation runs concurrently on
an ephemeral Thread while the complete business answer remains on the bound Thread.
A scenario is not accepted merely because the backend protocol works.
