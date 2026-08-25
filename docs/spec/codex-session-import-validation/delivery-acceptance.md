# Codex Workspace Session Import Delivery Acceptance

## Scope

This document is the release contract for importing every existing Codex Thread
that belongs to one registered DSH Workspace. The implementation lives in the
Codex plugin. The official DSH checkout remains unmodified.

An imported Session is successful only when all of these statements are true:

1. DSH owns a normal, durable Session and lists it under the target Workspace.
2. The Session has a one-to-one binding to the pre-existing Codex Thread.
3. Opening it shows the available historical user and assistant messages as normal
   DSH chat history, without an import notice replacing the conversation.
4. The composer continues the same Codex Thread through App Server and sends only
   the newest DSH user input.
5. Repeating or recovering the import creates neither a second DSH Session nor
   duplicated projected messages.
6. Before any imported Session is opened, its Workspace row shows the Codex Thread
   name or preview-derived fallback rather than the Workspace directory name.
7. Imported rows use the inventory value returned by Codex `thread/list.updatedAt`
   for recency, so a batch import does not replace source activity order with import
   execution order. `thread/read.updatedAt` is not a recency authority because older
   Threads may report a different value there.
8. Each transition that opens an imported Session performs one incremental
   `thread/read`. Missing terminal external Codex Turns appear in DSH without
   reopening the import modal. The same open interval does not poll, and no sync is
   added to submit, Workspace background activity, or a manual command.

Codex remains authoritative for model context, compaction, tool state, and execution.
DSH's historical projection is presentation state, not a replacement Codex context.
The plugin must persist only event types understood by official DSH. Codex tool and
compaction activity remains in the bound Thread instead of entering the DSH log as
downstream-private events.

## Supported UI Surface

The action is a Workspace-level action in the sidebar and is not a Settings panel.
It is labelled `Import Codex Sessions` when the sidebar is expanded and has an
accessible tooltip in rail mode.

Official DSH revision `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` exposes
`sidebar.footer.action` to plugins, but it does not expose an additive action slot
beside the Workspace browser's built-in `Add workspace...` action. This delivery
therefore uses the supported sidebar action immediately below the Workspace browser
and above Settings. Moving the action into the Workspace menu is a separate DSH
extension-point change; DOM mutation or private-component replacement is forbidden.

## User Flow

### First Import

1. The user installs and enables the Codex plugin. `Import Codex Sessions` appears
   in the sidebar. No import management section appears in Settings.
2. The user opens an existing DSH Workspace or its Session, then clicks the import
   action.
3. DSH opens a modal and resolves the target from the current Session's Workspace,
   falling back to the most recently active Workspace. The modal shows the exact
   Workspace title and canonical path.
4. The plugin scans Codex App Server. During scanning, the action and confirm button
   are disabled and the modal announces progress.
5. The modal shows `found`, `already imported`, and `ready to import` counts. It does
   not offer per-Thread checkboxes in this release.
6. The user clicks `Import all`. The modal shows completed and total counts. Closing
   the modal during the operation is disabled.
7. Completion reports imported, existing, and failed counts. Imported Sessions
   appear under the Workspace without restarting DSH, already show their Codex
   titles, and are ordered by source Thread recency before any row is opened.
8. The user clicks an imported Session. Native DSH chat history is already present;
   the plugin performs one incremental reconciliation for terminal Codex Turns,
   with no import explanation message or separate imported-history view.
9. The user submits a new request. The original Codex Thread resumes and receives
   only this newest request. The assistant response appears through the ordinary DSH
   Codex conversation path.

### Repeat And Recovery

1. Opening the import action again rescans App Server and reports existing bindings.
2. `Import all` may repair an incomplete import, but cannot allocate another Session
   for an already-bound Thread.
3. Historical projection uses deterministic source message IDs. Rehydration appends
   only missing messages.
4. A Thread with another active App Server writer remains bound to its original
   Session. DSH reports a stable `CODEX_THREAD_ACTIVE_WRITER` retryable error that
   explains that a UI Session switch may not release the writer and the owning Codex
   app, CLI, or App Server process must fully exit or restart before retry. It never
   silently creates a replacement Thread. A later submit after owner release resumes
   the same Thread ID.
5. Switching away and opening the Session again performs another reconciliation.
   Repeated notifications while the same Session remains selected do not trigger
   additional reads.

### Empty And Failure States

- No Workspace: the modal explains that a Workspace must be opened and provides no
  import command.
- No matching Threads: the modal reports zero found; no DSH state is changed.
- App Server unavailable or incompatible: scanning fails with a retry action; no
  partial Session is created.
- Per-Thread failure: the batch continues, preserves successful imports, reports the
  failed Thread by non-sensitive short identifier, and offers retry.
- Missing or deleted bound Thread: continuation fails visibly and preserves the
  binding for diagnosis; it never starts a replacement Thread.

## Acceptance Matrix

Every scenario is a release gate unless explicitly marked `manual`. Automated tests
must use sanitized temporary Workspaces and may not persist real prompts, paths,
credentials, account details, or Thread IDs as repository evidence.

| ID | Scenario | Required assertion | Test layer |
| --- | --- | --- | --- |
| CIA-001 | Inventory paginates | Every page is requested until `nextCursor` is absent | Runtime unit |
| CIA-002 | Source kinds are explicit | Inventory includes supported interactive and exec/App Server source kinds | Runtime unit |
| CIA-003 | Canonical Workspace match | Exact and symlink-equivalent cwd match; child and sibling paths do not | Runtime unit + live |
| CIA-004 | Archived policy | Archived Threads are excluded from the default import inventory | Runtime unit |
| CIA-005 | Stable inventory summary | Found, existing, importable, and invalid counts are deterministic | Coordinator unit |
| CIA-006 | One-to-one binding | One Codex Thread maps to exactly one DSH Session | Store + integration |
| CIA-007 | Deterministic recovery | Retry after each transaction boundary converges on one Session and binding | Fault-injection integration |
| CIA-008 | Existing import is idempotent | Repeated import creates zero additional Sessions | Integration |
| CIA-009 | Native DSH Session | Imported Session uses the Codex preset/provider, title, canonical cwd, and Workspace membership | Official DSH integration |
| CIA-010 | Historical message order | Supported user and assistant messages retain source turn/item order | Projection unit + DSH integration |
| CIA-011 | Projection idempotency | Reprojection appends zero duplicate messages | Projection unit + cold resume |
| CIA-012 | Unsupported items are bounded | Unknown, compaction, tool, and raw items are skipped without aborting import | Projection unit |
| CIA-013 | Empty history | A zero-turn Thread imports as a usable blank DSH Session | Integration |
| CIA-014 | Continue original Thread | First new prompt resumes the imported Thread ID and does not call `thread/start` | Adapter integration + live |
| CIA-015 | Newest input only | App Server receives the new DSH user input, not projected history | Adapter integration |
| CIA-016 | Strict imported binding | Resume errors never replace an imported Thread | Adapter unit |
| CIA-017 | Active writer | Writer conflict has stable code `CODEX_THREAD_ACTIVE_WRITER`, actionable owner-release guidance, and `retryable: true`; the original binding remains and the next submit after owner exit resumes the same Thread ID without `thread/start` | Adapter unit + live App Server |
| CIA-018 | Missing Thread | Missing/deleted Thread is surfaced and no replacement is created | Adapter unit + live |
| CIA-019 | Batch partial failure | Other Threads commit; failed entries remain retryable and summarized | Fault-injection integration |
| CIA-020 | Live list update | Completed imports arrive in the Workspace Session list without restart | Browser E2E |
| CIA-021 | Sidebar entry placement | Action is outside Settings, below Workspace browser, and accessible in wide/rail modes | Component + Browser E2E |
| CIA-022 | Target resolution | Current Session Workspace wins, then recent Workspace; no target disables import | Component unit |
| CIA-023 | Scan states | Idle, scanning, summary, empty, and scan-error views expose correct controls and announcements | Component unit |
| CIA-024 | Import states | Confirm, progress, partial, complete, retry, and close-lock behavior are correct | Component unit + Browser E2E |
| CIA-025 | No per-Thread selection | The release surface has one batch command and no Thread checkboxes | Component unit |
| CIA-026 | Native history opening | Clicking an imported Session opens native history with an enabled composer after hydration | Browser E2E |
| CIA-027 | No import notice message | No synthetic explanation message is inserted into Session history | Projection + Browser E2E |
| CIA-028 | Refresh and cold resume | Imported Session survives host restart and remains attached and bound | Official DSH cold integration |
| CIA-029 | Protocol drift | Required App Server methods and fields pass generated-schema compatibility checks | Version compatibility |
| CIA-030 | Bulk bound | 100-Thread import completes within the recorded local threshold and reports monotonic progress | Performance integration |
| CIA-031 | Local route safety | Import HTTP route rejects wrong methods, malformed bodies, oversized bodies, and non-loopback unauthenticated callers | HTTP unit |
| CIA-032 | Evidence privacy | Acceptance artifacts contain no home path, account data, secrets, or live Thread IDs | Evidence verifier |
| CIA-033 | Responsive UI | At desktop and mobile widths, modal text and controls do not overlap or escape their containers | Browser screenshot |
| CIA-034 | Keyboard/accessibility | Action, modal, retry, cancel, and import controls have names, focus order, Escape behavior, and live progress | Component + Browser E2E |
| CIA-035 | Official event vocabulary | Import and later Codex turns persist no downstream-private DSH event type; cold load never depends on mutating a package-local event catalog | Unit + official DSH cold restart |
| CIA-036 | Immediate imported title | Every imported row shows its Codex name or preview fallback after batch completion and before opening; no row falls back to the Workspace basename while its title projection is pending | Projection-cache integration + Browser E2E |
| CIA-037 | Source recency order | Imported Session `updatedAt` equals Codex inventory `thread/list.updatedAt` in milliseconds, including ties and zero-turn Threads; newest source Thread is listed first independent of batch execution order, even when `thread/read.updatedAt` differs | Seed unit + official DSH integration + Browser E2E |
| CIA-038 | Open-time incremental sync | Opening an imported Session performs exactly one read, appends missing terminal external Turns (`completed`, `interrupted`, and `failed`) with matching DSH end reasons, skips `inProgress` and DSH-owned Turns, updates the open conversation without duplicate messages, and performs another read only after selection leaves and returns; native Sessions are a no-op | Reconcile unit + route integration + Browser E2E |

## Test Architecture

### Fast Contract Suite

The plugin's `npm test` suite owns deterministic tests for inventory pagination,
path matching, summary derivation, link-store migration, transaction recovery,
projection, strict binding, route validation, and UI state reducers. Every production
branch must be reachable without launching a real Codex process. Timestamp tests use
fixed source seconds and assert the exact DSH millisecond value rather than only
relative order.

### Official DSH Integration Suite

The Relay-owned test harness mounts the immutable official DSH revision with the
built Codex plugin. It creates a temporary Workspace, imports synthetic Threads,
flushes Session persistence, disposes the host, cold resumes it, and asserts native
history, Workspace membership, binding, continuation behavior, source recency, and
that the title projection is durable before the import transaction returns.

### Browser Acceptance Suite

Playwright runs the actual DSH Web bundle with the plugin. It verifies the complete
click flow, loading and error states, immediate Session-list updates, opening native
history, pre-open titles, source-recency order, submitting a continuation,
one open-time external-history reconciliation, selection-away-and-return behavior,
accessibility roles, and desktop/mobile
screenshots. Browser tests use a deterministic fake App Server for all state branches;
one bounded smoke test uses the local real App Server.

### Live Compatibility Suite

Sanitized probes create disposable Codex Threads in a temporary Codex profile and
Workspace. They verify source-kind inventory, canonical cwd, compaction resume,
active-writer behavior, deletion behavior, and cross-version continuation. Every
created Thread and temporary directory is removed after the run.

## Per-Modification Review Gate

A modification is deliverable only when its review record contains all of:

1. Changed behavior and the CIA scenario IDs it implements or preserves.
2. The automated test added or updated for each changed branch.
3. The exact verification command and result.
4. A diff review for unrelated changes, unsafe fallback behavior, privacy leaks,
   missing failure states, and SPEC/code mismatch.
5. A residual-risk statement. `Not tested` is acceptable only for explicitly manual
   visual checks and must block release until that check is recorded.

Review records are appended to
`dsh-lab/codex-session-import/delivery-review-log.md`. A code change without mapped
CIA scenarios or reproducible evidence must be reverted before the next modification.

## Final Delivery Gate

Release requires:

- all CIA scenarios passing at their required layers;
- `npm run verify` passing in the Codex plugin;
- official DSH integration and cold-resume runs passing at the recorded commit;
- Playwright desktop and mobile screenshots reviewed for overlap and state clarity;
- the evidence privacy verifier passing;
- no modifications in `upstream/deepseek-harness/`;
- imported and continued Sessions cold-load without unknown-event errors;
- SPEC behavior, implementation behavior, tests, and user-facing copy agreeing.
