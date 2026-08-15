# Codex In Native DSH Web Acceptance Report

## Status

**PASS** on 2026-08-15 after P0 revalidation.

The previous PASS was reopened after live acceptance found that DSH's automatic
`session-title` request could enter the bound business Thread and replace the real
answer. Auxiliary calls are now isolated and the affected path has been revalidated
with a clean new Session against the real Codex App Server.

Codex now runs as the execution backend of an ordinary DSH Session. The delivered
surface is DSH's native new-Session hero, Session navigation, header, Chat/Trajectory
views, composer, model and permission controls, assistant rendering and attachment
gallery. The earlier full-page prototype, duplicate composer and manual Wait/Event
controls are not present in the production bundle.

Validated baselines:

| Component | Version |
| --- | --- |
| DSH | `fc18096c87fababb8429b51df655c22649f74e6f` |
| Codex CLI / App Server | `0.147.0-alpha.6.5` |
| Browser surface | Native DSH Web at `http://127.0.0.1:4317` |

## Scenario Results

| Scenarios | Result | Evidence |
| --- | --- | --- |
| `CXA-001` - `CXA-006` | PASS | Native Codex preset, first turn, two appended turns, Session switch, Host restart and persistent Thread continuity were exercised live; concurrency and isolation are automated. |
| `CXA-007` - `CXA-011` | PASS | Native DSH header, tabs and composer remained in place. Live reasoning, commentary, Bash start/completion and command output streamed into the normal conversation. |
| `CXA-012` | PASS | Codex generated an image, produced a final 64x64 PNG, called image view, and both images appeared as clickable native DSH image nodes. Attachment import and path containment also pass automated tests. |
| `CXA-013` - `CXA-014` | PASS | App Server approval and question requests are protocol-tested through DSH approval/question services, including fail-closed ownership. |
| `CXA-015` - `CXA-018` | PASS | A live Codex dynamic tool registered `relay.acceptance.ready`; an HTTP Event produced durable Event, Delivery and Activation records and resumed the same Codex Thread through the DSH inbox. Duplicate, busy and retry behavior pass automated tests. |
| `CXA-019` | PASS | Static production scan found no prototype conversation/view, duplicate composer, `xx.completed`, manual Wait/Event trigger, old gateway, or test boot marker. |
| `CXA-020` | PASS | Live loopback `POST /api/relay/events` returned a resolved Event and Delivery. Automated tests cover non-loopback bearer authentication, invalid JSON, size limits and runtime 5xx failures. |
| `CXA-021` - `CXA-022` | PASS | Transport failures, cancellation, image failures and the pinned DSH cold-resume compatibility path pass automated tests. |
| `CXA-023` | PASS | Desktop and compact Chrome compositions were visually inspected. The compact layout collapsed the sidebar and retained readable activity, image and composer controls without overlap. Chrome enforced its minimum outer-window width while the DSH compact breakpoint was active. |
| `CXA-024` | PASS | A clean native Session generated the title `列出项目全部文件` while the bound business Thread returned the complete three-file answer. Its persisted rollout contains two business turns and zero title-generation prompts. A direct real-App-Server probe also returned `ephemeral: true` with no tool items. |
| `CXA-025` | PASS | Automated failure injection proves a failed title call releases its temporary Thread, creates no main binding and appends no activity. DSH's title service retains its deterministic fallback on provider failure. |
| `CXA-026` | PASS | Expanding the live native Bash activity displayed `Codex App Server` plus shortened Thread and Turn identifiers; the full identifiers are available through the row title. |

The live Event response resolved Event `82797193-4fd8-47bd-a226-bba4e64b2ee8`
to the owning DSH Session and Wait. The automatically created native conversation
turn replied `EVENT_RESUMED EVENT_PAYLOAD_43`, proving that the Relay envelope, not
the preceding human prompt, reached the existing Codex Thread.

The P0 revalidation used bound Thread
`01a003e0-e379-77e1-addb-41a2074526b7`. Its first turn returned
`.claude/settings.local.json`, `hello.md` and `white-bg-blue-square.png`; its second
turn answered `white-bg-blue-square.png` from prior context. The rollout contains no
`dsh-session-title-llm` or `Generate the session title` input. The earlier contaminated
Session remains untouched as defect evidence and is not counted as a clean acceptance
run.

## Automated Evidence

- `npm test`: **49 passed, 0 failed**.
- `npm run experiment:dsh-cold-resume`: **PASS**, with two persisted messages, two
  model requests and two completed turn boundaries.
- Host and client production bundle: **PASS** during `npm run start:web`.
- JavaScript syntax checks: **PASS** for App Server transport/runtime and DSH adapter,
  dynamic tools and Event ingress.
- `git diff --check`: **PASS**.
- Prototype residue scan: **PASS**.

## Review Fixes

End-to-end review found and fixed these issues before acceptance:

1. Current Codex App Server sends dynamic tool requests as `item/tool/call`; the
   adapter had recognized only the older method name. It now handles the current
   method and retains compatibility with the older name.
2. A Relay inbox activation was initially displayed in DSH but the adapter replayed
   the previous human prompt into Codex. Input selection now forwards the newest
   `source.kind=plugin, plugin=relay` envelope for activation turns while continuing
   to exclude unrelated DSH context injections.
3. Codex reasoning descriptions were too long for the compact native model control.
   They now use concise native labels such as `Low`, `High` and `Extra high`.
4. Dynamic tools require the App Server experimental API capability. The client now
   advertises that capability during initialization and tests the real handshake.
5. DSH automatic title generation inherited the Session's `relay-codex` route and
   entered the bound business Thread while its first turn was active. The adapter now
   routes all purpose calls to unlinked ephemeral read-only Threads with no Relay
   tools, releases them after completion, and refuses unrelated plugin messages on
   the main path. Concurrent isolation, failure cleanup and a real App Server probe
   are covered by tests.
6. Native activity rows did not expose definitive execution provenance. Their
   expanded detail now identifies Codex App Server and the exact Thread/Turn pair
   without adding a debug surface.

No unresolved product defects were found in the accepted scope.
