# Codex Session Import Delivery Review Log

## MOD-001: Delivery Acceptance Contract

- Date: 2026-08-25
- Files:
  - `docs/spec/codex-session-import-validation/delivery-acceptance.md`
  - `docs/spec/codex-session-import-validation/README.md`
- CIA coverage: CIA-001 through CIA-034 are defined as delivery scenarios.
- Verification: `git diff --check` passed with no output.
- Review:
  - The flow opens imported Sessions as native DSH history and never inserts an
    import explanation message.
  - Continuation, presentation, and operational safety remain separate claims.
  - Every UI and failure state has an observable assertion and named test layer.
  - The official DSH revision and its missing Add Workspace action slot are recorded;
    the plan uses only the supported sidebar extension point.
  - No real path, account data, secret, or Thread ID was added.
- Residual risk: exact placement inside the built-in Workspace menu remains outside
  the plugin-only delivery until DSH exposes an additive action slot. This does not
  block the supported sidebar Workspace action specified for this release.

## MOD-002: Workspace Thread Inventory

- Date: 2026-08-25
- Files:
  - `integrations/codex/session-runtime.mjs`
  - `integrations/codex/test/session-runtime.test.mjs`
- CIA coverage: CIA-001, CIA-002, CIA-003, CIA-004.
- Verification:
  - `node --test test/session-runtime.test.mjs`: 10 passed, 0 failed.
  - `npm test`: 64 passed, 0 failed.
  - `git diff --check`: passed with no output.
- Review:
  - Startup discovery and import inventory share the same cursor-paginated path.
  - `sourceKinds` is explicit and excludes subagent-only sources.
  - Canonical and symlink-equivalent cwd values match; child and sibling paths are
    rejected even if a server returns them unexpectedly.
  - Cross-page duplicate IDs and ephemeral Threads are excluded.
  - A repeated non-null cursor fails instead of looping forever.
  - Inventory returns metadata only and does not persist prompts or App Server data.
- Residual risk: exact source-kind names remain protocol-version-sensitive and are
  covered by CIA-029's generated-schema compatibility gate before release.

## MOD-003: Strict Binding And Recoverable Import Transaction

- Date: 2026-08-25
- Files:
  - `integrations/codex/codex-adapter.js`
  - `integrations/codex/codex-import.mjs`
  - `integrations/codex/test/dsh-adapter.test.mjs`
  - `integrations/codex/test/codex-import.test.mjs`
- CIA coverage: CIA-005, CIA-006, CIA-007, CIA-008, CIA-016, CIA-019.
- Verification:
  - `node --test test/codex-import.test.mjs test/dsh-adapter.test.mjs`: 24 passed,
    0 failed.
  - `npm test`: 71 passed, 0 failed.
  - `git diff --check`: passed with no output.
- Review:
  - Imported bindings persist their strict mode and transaction state.
  - A resume failure preserves the imported Thread and never calls `thread/start`.
  - Thread-to-Session and Session-to-Thread collisions are rejected.
  - Transaction state is monotonic and rejects unknown values.
  - Fault injection after prepare, hydrate, attach, and finalize converges on one
    Session, one history identity, and one Workspace attachment after retry.
  - Partial batches preserve committed entries and expose incomplete entries as
    recoverable; concurrent batches coalesce per Thread.
- Residual risk: the coordinator currently uses a test target. Native DSH Session
  creation, history projection, Workspace attachment, and cold-resume behavior are
  the release gates for MOD-004.

## MOD-004: Native DSH Target And Historical Projection

- Date: 2026-08-25
- Files:
  - `integrations/codex/dsh-import-target.js`
  - `integrations/codex/session-runtime.mjs`
  - `integrations/codex/plugin.mjs`
  - `integrations/codex/test/dsh-import-target.test.mjs`
  - `integrations/codex/test/session-runtime.test.mjs`
  - `dsh-lab/codex-session-import/delivery-dsh-probe.ts`
- CIA coverage: CIA-009, CIA-010, CIA-011, CIA-012, CIA-013, CIA-015,
  CIA-027, CIA-028.
- Verification:
  - `node --test test/session-runtime.test.mjs test/dsh-import-target.test.mjs`:
    13 passed, 0 failed.
  - `npm test`: 74 passed, 0 failed.
  - Official DSH delivery probe: created, cold-resumed, projected 2 messages,
    reprojected 0 messages, and continued successfully.
  - `git diff --check`: passed in Relay and the Codex plugin.
  - `git status --short` in official DSH checkout: clean.
- Review:
  - Historical hydration uses `thread/read(includeTurns: true)` and neither resumes
    nor starts a Codex Thread.
  - Projection emits only native DSH user and assistant message events with stable
    source-derived IDs and source order.
  - Compaction, reasoning, tool, raw, and unknown items remain Codex-owned and do
    not block import.
  - Empty history is made durable by its official log-only `session/title` event,
    not a private marker or synthetic chat explanation.
  - Production target creates or resumes a normal Codex-preset DSH Session, flushes
    history, attaches Workspace membership, and releases non-resident handles.
- Residual risk: the target is not yet reachable from the Web client. HTTP route
  validation and the sidebar flow are the gates for MOD-005 and MOD-006.

## MOD-005: Authenticated Workspace Import Route

- Date: 2026-08-25
- Files:
  - `integrations/codex/codex-import-route.js`
  - `integrations/codex/dsh-plugin.js`
  - `integrations/codex/host-plugin.js`
  - `integrations/codex/plugin.mjs`
  - `integrations/codex/test/codex-import-route.test.mjs`
  - generated `integrations/codex/lib/host-plugin.js` and source map
- CIA coverage: CIA-020, CIA-023, CIA-024, CIA-030, CIA-031.
- Verification:
  - `node --test test/codex-import-route.test.mjs`: 4 passed, 0 failed.
  - `npm run verify`: typecheck passed, 78 tests passed, host/client build passed.
- Review:
  - Only POST JSON requests within the size bound are accepted.
  - The requested canonical path must resolve to a registered DSH Workspace before
    App Server inventory or import begins.
  - Loopback is accepted; non-loopback requests require a timing-safe bearer token.
  - Scan responses contain Workspace display metadata and aggregate counts only.
  - Import progress is real NDJSON output from coordinator checkpoints, followed by
    one complete or error frame.
  - Route and import target are disposed with the Codex plugin lifecycle.
- Residual risk: the Web client still needs robust NDJSON parsing, target Workspace
  resolution, accessible states, and browser-level verification in MOD-006.

## MOD-006: Workspace Import UI And Immediate Refresh

- Date: 2026-08-25
- Files:
  - `integrations/codex/src/client/WorkspaceImportAction.tsx`
  - `integrations/codex/src/client/WorkspaceImportAction.module.css`
  - `integrations/codex/src/client/workspace-import-client.mjs`
  - `integrations/codex/src/client/workspace-import-ui-policy.mjs`
  - `integrations/codex/src/client/index.ts`
  - `integrations/codex/src/client/locales.ts`
  - `integrations/codex/test/workspace-import-client.test.mjs`
  - `integrations/codex/test/workspace-import-ui-policy.test.mjs`
- CIA coverage: CIA-020 through CIA-026, CIA-033, CIA-034.
- Verification:
  - Workspace client and UI policy tests: 6 passed, 0 failed after refresh and
    every footer/close policy branch were covered.
  - TypeScript typecheck and host/client builds passed.
  - Real DSH Browser E2E passed desktop and 390x844 mobile checks.
- Review:
  - The action uses official `sidebar.footer.action`, below the Workspace browser
    and above Settings; no private DOM or Settings panel is used.
  - The target is current Session Workspace first, then recent Workspace.
  - Scan, summary, progress, complete, partial, retry, empty, and no-Workspace
    states have named controls; there is one whole-Workspace command and no
    per-Thread selection.
  - Real E2E initially found that the new row required a page reload. Completion
    now awaits official Session and Workspace baseline refreshes in that order;
    a repeated clean run showed the row immediately.
  - Desktop and mobile screenshots show wrapped paths, stable metric layout, and
    no overlapping controls.
- Residual risk: official DSH does not expose a slot beside its built-in Add
  Workspace action. The supported footer placement remains the release contract.

## MOD-007: Official Event Vocabulary And Cold Restart Safety

- Date: 2026-08-25
- Files:
  - `integrations/codex/dsh-import-target.js`
  - `integrations/codex/codex-adapter.js`
  - `integrations/codex/dsh-plugin.js`
  - `integrations/codex/host-plugin.js`
  - `integrations/codex/src/client/index.ts`
  - `integrations/codex/test/dsh-import-target.test.mjs`
  - `integrations/codex/test/dsh-adapter.test.mjs`
- CIA coverage: CIA-013, CIA-014, CIA-026, CIA-028, CIA-035.
- Verification:
  - Adapter, import target, and Workspace client tests: 24 passed, 0 failed.
  - TypeScript typecheck and host/client builds passed.
  - Real App Server read showed three turns on the same original Thread after two
    DSH continuations.
  - DSH was stopped and restarted; all three turns loaded, no
    `SessionFormatUnsupportedError` appeared, and the composer remained enabled.
  - Official DSH delivery probe passed initial cold resume, continuation followed
    by another cold resume, idempotent reprojection, and empty-history cold resume.
- Review:
  - The first Browser E2E exposed an unknown `relay-codex/import` event on cold
    load. It was replaced by official log-only `session/title` persistence.
  - A second cold run exposed the pre-existing `relay-codex/activity` event after
    continuation. Official DSH explicitly has no downstream event registration
    surface, so all private persistent activity events were removed.
  - Codex tool, reasoning, raw, and compaction state remains authoritative in App
    Server. DSH persists only its official presentation and execution events.
  - Unit tests assert imported projection uses only official known event types and
    the adapter appends no downstream-private events.
- Residual risk: unsupported historical Codex activity is intentionally omitted
  from DSH presentation under accepted risk CSI-010; it remains available to Codex
  for model context and continuation.

## MOD-008: Immediate Titles And Source Recency

- Date: 2026-08-25
- Files:
  - `docs/spec/codex-session-import-validation/delivery-acceptance.md`
  - `docs/spec/codex-session-import-validation/CSI-004-dsh-session-creation.md`
  - `integrations/codex/dsh-import-target.js`
  - `integrations/codex/test/dsh-import-target.test.mjs`
  - `dsh-lab/codex-session-import/delivery-dsh-probe.ts`
  - `integrations/codex/README.md`
  - `integrations/codex/README.zh.md`
- CIA coverage: CIA-036, CIA-037.
- Verification:
  - Target tests: 7 passed, 0 failed.
  - `npm run verify`: typecheck passed, 88 tests passed, and host/client builds
    completed.
  - Official DSH delivery probe passed immediate title projection, exact source
    recency, zero-turn recency, and cold resume.
  - A clean real-App-Server import created 28 Sessions. Before opening any imported
    row, all 28 had non-empty Codex-derived titles and the list was monotonic by
    source recency. All 27 stable source Threads matched `thread/list.updatedAt`
    exactly; the active validation Thread was excluded because it continued changing.
  - After stopping and restarting official DSH, `session.list` returned all 28 titles,
    all 28 rows had durable recency metadata, and order remained monotonic before any
    imported Session was opened.
  - Browser reload after cold restart showed both newest imported titles in source
    order while the selected Session remained the pre-existing blank Session.
- Review:
  - The first real acceptance run matched only 16 stable timestamps. Inspection
    showed that old Threads can expose different `updatedAt` values from `thread/read`
    and `thread/list`; the implementation now treats scan inventory as authoritative.
  - New Sessions are created with a native DSH historical seed whose event times are
    the exact source inventory timestamp. Zero-user histories use that time in the
    Session header so DSH has a recency value to fold.
  - Hydration flushes the title event and awaits the official projection-cache write
    before the import transaction reports success, removing the click-to-resolve race.
  - Unit tests deliberately make list and read timestamps disagree, cover zero-turn
    imports, and hold the projection-cache write open to prove the durability barrier
    is awaited.
- Residual risk: Sessions committed by a pre-MOD-008 development build retain their
  original immutable event times. Acceptance uses a clean DSH Home; existing test
  data must be reimported into a clean profile rather than rewritten in place.

## MOD-009: Active Writer Recovery Contract

- Date: 2026-08-25
- Files:
  - `docs/spec/codex-session-import-validation/delivery-acceptance.md`
  - `docs/spec/codex-session-import-validation/CSI-006-concurrent-thread-use.md`
  - `integrations/codex/codex-adapter.js`
  - `integrations/codex/test/dsh-adapter.test.mjs`
  - `integrations/codex/README.md`
  - `integrations/codex/README.zh.md`
- CIA coverage: CIA-016, CIA-017.
- Verification:
  - Adapter and README tests: 21 passed, 0 failed.
  - `npm run verify`: typecheck passed, 89 tests passed, and host/client builds
    completed.
  - A sanitized real-App-Server two-client probe classified the conflict as
    `CODEX_THREAD_ACTIVE_WRITER`, marked it retryable, preserved the binding, and
    resumed the same Thread after the owner process exited.
- Review:
  - Generated `ThreadResumeParams` has no force/takeover field. `thread/list` and
    `thread/read` report the contender's `notLoaded` view and do not reveal another
    client's writer ownership, so safe preflight disabling is unavailable.
  - The real App Server returns generic JSON-RPC code `-32600`; classification must
    use the stable `already has an active writer` error semantics and expose a
    plugin-owned stable code to DSH.
  - The first live probe used a zero-turn Thread and was rejected as invalid because
    no rollout existed yet. The accepted run first committed one sanitized turn,
    then executed conflict, owner exit, retry, and cleanup.
  - Active-writer failure never calls `thread/start`, changes the binding, kills the
    owner, or silently forks. The pending-operation slot clears on rejection so the
    next DSH submit performs a fresh native resume.
- Residual risk: App Server does not expose the owner identity or a release signal.
  DSH cannot automatically know when to re-enable or retry; the owning process must
  release or exit before the user submits again. A later live investigation confirmed
  that a Codex Desktop UI Session switch alone may not release its writer locks.

## MOD-010: Open-Time Imported History Sync

- Date: 2026-08-25
- Files:
  - `docs/spec/codex-session-import-validation/delivery-acceptance.md`
  - `docs/spec/codex-session-import-validation/CSI-008-history-availability.md`
  - `docs/spec/codex-session-import-validation/CSI-009-history-idempotency.md`
  - `integrations/codex/codex-history-sync.mjs`
  - `integrations/codex/codex-sync-contract.mjs`
  - `integrations/codex/codex-sync-route.js`
  - `integrations/codex/codex-adapter.js`
  - `integrations/codex/codex-link-store.js`
  - `integrations/codex/dsh-import-target.js`
  - `integrations/codex/dsh-plugin.js`
  - `integrations/codex/src/client/session-open-sync.mjs`
  - `integrations/codex/src/client/session-open-sync.d.mts`
  - `integrations/codex/src/client/index.ts`
  - focused tests for adapter, target, synchronizer, route, and Client selection
  - generated Host and Client bundles
  - `dsh-lab/codex-session-import/delivery-dsh-probe.ts`
  - bilingual plugin READMEs
- CIA coverage: CIA-038; preserves CIA-026, CIA-028, CIA-031, CIA-035.
- Verification:
  - Focused open-sync suite: 35 passed, 0 failed.
  - `npm run verify`: typecheck passed, 99 tests passed, and Host/Client builds
    completed.
  - Official DSH delivery probe at commit `b150a551` appended two messages from one
    newly completed external Turn, appended zero on unchanged repetition, deferred
    one in-progress Turn, and cold-resumed without unknown events.
  - A real official DSH Host on port 3099 returned `synced` for a committed imported
    Session and `not-imported` for a native Session through the production route.
  - Browser automation could open the first local page, but its security policy
    blocked the required reload after the Host restart. CIA-038 Browser E2E remains
    pending manual selection-away-and-return verification and is not recorded as
    passed.
- Review:
  - The Client observes only public current-Session selection state. One selection
    interval issues one request; leaving and returning permits another request.
  - The Host reads with `thread/read` and does not resume or acquire writer ownership.
  - Only completed external user/assistant Turns are appended with official DSH event
    types. In-progress Turns wait for a later open.
  - Stable role message IDs, persisted DSH-owned Turn IDs, replay-state Turn IDs, and
    a per-Session single-flight guard prevent duplicate projection.
  - Native and incomplete imported bindings are no-ops. Sync failures are logged in
    the Client and do not prevent the Session from opening.
  - No polling, submit-time synchronization, manual refresh, rollback mirroring, or
    live partial projection was added.
- Residual risk: browser-level trigger verification is pending because the local URL
  reload was blocked by the browser automation policy. The running DSH instance is
  available for the required manual click test; release remains blocked on that CIA
  item even though deterministic Client, route, and official DSH integration layers
  passed.

## MOD-011: Process-Level Writer Guidance Correction

- Date: 2026-08-25
- Files:
  - `docs/spec/codex-session-import-validation/CSI-006-concurrent-thread-use.md`
  - `docs/spec/codex-session-import-validation/delivery-acceptance.md`
  - `integrations/codex/codex-adapter.js`
  - `integrations/codex/test/dsh-adapter.test.mjs`
  - bilingual plugin READMEs
  - `dsh-lab/codex-session-import/active-writer-owner-validation-20260825.json`
- CIA coverage: CIA-016 and CIA-017.
- Verification:
  - A local writer-lock inspection identified the active owner as the Codex Desktop
    App Server process, not either running DSH App Server.
  - The same owner retained many Thread writer locks concurrently after UI Session
    switches, disproving the previous switch-to-release guidance.
  - Adapter tests assert the corrected process-exit guidance while preserving stable
    error code, retryability, Thread identity, and no-replacement behavior.
- Review:
  - The change does not attempt lock-file deletion, process termination, force
    takeover, silent fork, or binding replacement.
  - Read-only open-time history sync remains available because it uses `thread/read`;
    only `thread/resume` and continuation require writer ownership.
- Residual risk: current App Server protocol provides no supported cross-process
  handoff request. Seamless alternating writes between Codex Desktop and DSH therefore
  require an upstream owner-release mechanism or a shared App Server architecture.

## MOD-012: Terminal Turn History Completeness

- Date: 2026-08-25
- Files:
  - `docs/spec/codex-session-import-validation/CSI-008-history-availability.md`
  - `docs/spec/codex-session-import-validation/CSI-009-history-idempotency.md`
  - `docs/spec/codex-session-import-validation/delivery-acceptance.md`
  - `integrations/codex/dsh-import-target.js`
  - `integrations/codex/test/dsh-import-target.test.mjs`
  - bilingual plugin READMEs
  - `dsh-lab/codex-session-import/delivery-dsh-probe.ts`
  - `dsh-lab/codex-session-import/terminal-turn-sync-validation-20260825.json`
- CIA coverage: CIA-014, CIA-026, CIA-035, and CIA-038.
- Verification:
  - The reported source Thread contained 34 `completed` Turns followed by one
    `interrupted` Turn. The production sync route appended zero because the previous
    filter admitted only `completed`, directly reproducing the missing-latest-history
    report.
  - Target tests project `completed`, `interrupted`, and `failed`, preserve matching
    DSH turn-end reasons, and defer only `inProgress`.
  - Official DSH delivery probe projected six messages from three terminal Turns,
    projected zero on unchanged repetition, deferred one running Turn, and cold
    resumed without unknown events.
  - After rebuilding and restarting the real DSH 3099 instance, the production route
    appended two messages from the reported interrupted Turn. Immediate repetition
    appended zero, and the durable Session log ended with official `interrupted`.
- Review:
  - App Server's generated Turn schema defines exactly `completed`, `interrupted`,
    `failed`, and `inProgress`; the implementation uses an explicit terminal allowlist
    and fails closed if a future unknown status appears.
  - Initial import seed and hydration use the same terminal filter as later opens, so
    an in-progress partial message cannot claim a stable projection ID and suppress
    its later terminal text.
  - Failed Turns use DSH's official error reason with a plugin-owned stable code;
    interrupted Turns use the official interrupted reason.
- Residual risk: the open trigger is selection-transition based. Re-clicking an
  already selected row does not constitute another open; the user must leave and
  return after a Turn becomes terminal.
