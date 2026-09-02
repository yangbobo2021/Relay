# Event Productization Delivery Review

Status: Provider-compatible implementation, official-DSH browser delivery,
authenticated Codex/Claude continuity, and the complete controlled-live GitHub
poll/webhook/Codex loop are verified. Gmail remains the sole environment gate and is
reported separately rather than simulated.

Candidate branch: `codex/relay-event-productization`

Official DSH: `0.1.2-alpha.3` at
`dd6322d604e00eec1ba5e0c8541159906a21094a`, clean before and after packed runs.

## Review A — Is Delivery Coverage Sufficient?

- Events schema v10, migration from v4/v5/v9, immutable Wait snapshots, exact and
  trusted routing, fan-out/conflict behavior, stable Activation retry, Router and
  Delivery budgets, notification receipts/manual retry, retention rollback, global
  admission limits, and keyset pagination are asserted against real SQLite or HTTP
  production paths.
- Monitors cover atomic baseline, timer timezone/overdue behavior, leases, restart,
  rearm, failure escalation, proposal budgets, and exact observation byte/depth/node
  limits before detector/commit.
- GitHub covers exact raw-body HMAC, five event families, unsupported dismissal,
  webhook/poll convergence, real HTTP pagination and hostile continuation links,
  repository lifecycle classes, project allowlists, and per-project credentials.
- Email covers first cursor, partial-page restart, bounded expired-cursor resync,
  push/poll overlap, provider errors, normalization/attachment policy, and durable
  mailbox lifecycle.
- Official DSH browser coverage includes real empty state to first Event, background
  refresh without draft/focus loss, loading/current/history views, stable pagination
  and filters, keyboard dialogs, Escape/focus behavior, 1280×720 and 1440×900,
  hostile text, English/Chinese persistence, light/dark computed WCAG AA contrast,
  durable Monitor cadence editing and validation, terminal/check/trigger evidence,
  Router lifecycle, connector credential lifecycle/redaction, stale/busy/provider/
  server/load/missing-Session failures, and clean console/network output.
- Provider-compatible tests do not prove an external SaaS account or actual model
  credential. Controlled-live evidence is mandatory only when those credentials and
  a disposable target are supplied; its absence is never relabeled as a local pass.

## Review B — Did The Tests Really Execute?

- Events discovered 52/52, Monitors 13/13, GitHub 21/21, Email 20/20, and Semantic
  Router 13/13 tests with zero skip/todo in their recorded release runs. Codex
  discovered 140/140 and Claude 5/5 adapter/plugin tests, followed by current-source
  builds.
- Official DSH installed freshly packed tarballs and emitted successful
  `AUDIT_RESULT` rows for the management suite and Events-only suite. The management
  replay independently recorded one routed message, two total Deliveries, two
  semantic calls, and a completed timer.
- Separate official DSH packed compositions booted Events/Monitors/Router with Codex
  and Claude backends, created and opened the existing backend-bound Session, and
  verified the client registrations without importing workspace source.
- Controlled-live GitHub installed packed artifacts into official DSH, armed the PR
  through the actual root-Agent tool, observed a real API transition, accepted a
  signed GitHub webhook with HTTP 202, and proved distinct durable Event/Delivery IDs
  reached the same existing Session. The disposable PR was restored open and green;
  the temporary webhook and tunnel were removed.
- Current-candidate authenticated traces recorded the same Codex Thread ID and the
  same Claude provider session ID before and after an exactly bound Relay Event. Each
  trace required one new assistant turn, one Relay input, and durable
  Event/Delivery/Activation evidence.
- The real EP09-010 loop required Codex itself to arm two successive GitHub Monitors.
  Relay's scheduler detected two actual PR changes and delivered both into the same
  Thread; completion required no live Wait or Monitor to remain.
- Browser failures were treated as failures: Escape closed the host panel, focus
  targeted a disconnected node, an Event filter lacked an explicit label, and
  first-run onboarding masks raced navigation. The computed contrast gate then caught
  sub-AA tertiary and business text; the cadence flow caught both a React event crash
  and a stale-state submission that looked correct in the input but had not persisted.
  Production issues were fixed; host timing was synchronized by visibility, never
  force-clicked or skipped.
- Mutation reviews broke Router terminalization, exclusive conflict handling, GitHub
  HMAC comparison, and Email cursor ordering; the targeted acceptance cases failed
  before each mutation was restored.
- A missing `DSH_ROOT` and a broken generated submodule pointer both failed before
  test discovery and were explicitly excluded from evidence.

## Reproduction

```bash
DSH_ROOT=/Users/boboyang/work/Relay/upstream/deepseek-harness npm test
DSH_ROOT=/Users/boboyang/work/Relay/upstream/deepseek-harness npm run test:package:event-product
DSH_ROOT=/Users/boboyang/work/Relay/upstream/deepseek-harness npm run test:docs:event-product

DSH_ROOT=/Users/boboyang/work/Relay/upstream/deepseek-harness \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node scripts/verify-dsh-official-install.mjs --events-ui-only

DSH_ROOT=/Users/boboyang/work/Relay/upstream/deepseek-harness \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node scripts/verify-dsh-official-install.mjs --events-only

DSH_ROOT=/Users/boboyang/work/Relay/upstream/deepseek-harness \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node scripts/verify-dsh-official-install.mjs --event-backends-only

DSH_ROOT=/Users/boboyang/work/Relay/upstream/deepseek-harness \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node scripts/verify-dsh-official-install.mjs --backend-controlled-live

# Set a read-only test-repository token and coordination-file paths, start this
# verifier, then push one controlled transition after each stage file appears.
DSH_ROOT=/Users/boboyang/work/Relay/upstream/deepseek-harness \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
RELAY_GITHUB_TOKEN='<read-only test token>' \
RELAY_CONTROLLED_GITHUB_REPOSITORY='owner/disposable-repository' \
RELAY_CONTROLLED_GITHUB_PULL_NUMBER='1' \
RELAY_CONTROLLED_GITHUB_STAGE_FILE='/tmp/relay-phase-one.json' \
RELAY_CONTROLLED_GITHUB_SECOND_STAGE_FILE='/tmp/relay-phase-two.json' \
  node scripts/verify-dsh-official-install.mjs --github-codex-closed-loop
```
