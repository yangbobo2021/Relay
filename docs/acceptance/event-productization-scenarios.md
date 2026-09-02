# Event Productization Delivery Acceptance Scenarios

Status: Normative release index

These scenarios qualify the requirements in
[`../spec/event-productization.md`](../spec/event-productization.md). `release` means
the scenario is mandatory before public publication. `deployment-certification` is a
non-blocking live-provider check performed when a compatible provider account is first
deployed or when Relay's declared provider compatibility changes. Evidence must follow
[`test-review-protocol.md`](test-review-protocol.md); a unit-only result cannot satisfy
a scenario that names packed, browser, restart, network, or official-DSH evidence.

## Shared Environments

- `unit`: deterministic module test with fake clock/IDs and assertions on durable
  intermediate state.
- `sqlite`: integration test against a temporary on-disk SQLite database, including
  process/controller reopen when the scenario says restart.
- `packed`: `npm pack` artifacts installed into a clean directory with no workspace
  resolution.
- `official-dsh`: packed artifacts installed into a fresh DSH profile at a recorded
  immutable upstream commit.
- `browser`: Chromium automation against that fresh profile; console errors,
  unhandled rejections, failed resources, layout overflow, focus, and locale are
  asserted.
- `protocol`: an actual HTTP server/client exchange using exact raw bodies and headers,
  not a direct handler call.
- `controlled-live`: a sanitized controlled provider account or repository. No private
  customer content is allowed in evidence.

## Shared Publication Scenarios

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EPG-001 | Packed identity | Every acceptance process records tarball SHA-256, installed package version, resolved entry paths, and rejects workspace symlinks. | packed | release |
| EPG-002 | English UI baseline | All productized screens and dialogs render complete `en-US` text with no missing key, mixed locale, clipping, or horizontal overflow at 1280x720. | browser screenshots + DOM assertions | release |
| EPG-003 | Chinese UI baseline | The same flows render complete `zh-CN` text, localized date/time/number text, and no English fallback except proper nouns and protocol identifiers. | browser screenshots + DOM assertions | release |
| EPG-004 | Keyboard and accessibility | All controls are reachable in logical tab order, visible focus is retained through refresh/dialog close, buttons have accessible names, and status changes have appropriate live semantics. | browser accessibility assertions | release |
| EPG-005 | Browser cleanliness | The complete UI suite reports zero uncaught exceptions, unhandled rejections, failed static resources, unexpected 4xx/5xx, hydration errors, or React key warnings. | captured console/network log | release |
| EPG-006 | Clean official DSH | The official checkout commit is recorded and `git status --porcelain` is empty before and after all plugin composition and browser acceptance. | official-dsh report | release |
| EPG-007 | Locale persistence | Locale choice survives browser reload and Host restart without changing persisted protocol values or UTC timestamps. | browser + restart | release |
| EPG-008 | Upgrade compatibility | A database and DSH profile from the previous supported release upgrade to the candidate without losing unresolved Waits, Monitors, Events, or historical terminal evidence. | packed + sqlite + official-dsh | release |

## EP-01: Agent-Authored Wait Continuation

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP01-001 | Complete continuation registration | A root Agent registers every continuation field; the exact normalized values and version persist with the active Wait. | unit + sqlite | release |
| EP01-002 | Minimal backward-compatible registration | A legacy Wait without continuation remains valid and is read as an explicit empty continuation rather than guessed text. | migration + sqlite | release |
| EP01-003 | Atomic replacement | Replacing a Wait stores a new immutable continuation and supersedes the old phase in one transaction; historical content remains inspectable. | sqlite | release |
| EP01-004 | Invalid nested shape | Missing required nested types, unknown version, arrays where objects are required, invalid artifacts, and non-string instructions fail before changing the old Wait set. | unit + sqlite | release |
| EP01-005 | Size and Unicode bounds | Boundary-size English, Chinese, emoji, combining characters, and one-character-over-limit values are measured consistently and never truncate silently. | unit | release |
| EP01-006 | Ownership protection | A model-supplied Session ID is impossible through the Agent tool; continuation attaches only to the authenticated root Agent Session and is unavailable to subagent identity spoofing. | official-dsh Host contract | release |
| EP01-007 | External-content separation | Event fields containing continuation-like JSON, tool instructions, or prompt-injection text cannot modify the persisted continuation. | security integration | release |
| EP01-008 | UI history | Current and superseded continuation summaries render in both locales; long values wrap, sensitive artifacts are redacted, and historical records are read-only. | browser | release |

## EP-02: Complete Matched-Wait Delivery Envelope

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP02-001 | Single matched card | Delivered input contains Event, relation, evidence, and the exact committed Wait snapshot including continuation and artifacts. | inbox contract | release |
| EP02-002 | Multiple matched cards | Two non-exclusive Waits in one Session appear once each in stable registration order and are not collapsed into IDs. | integration | release |
| EP02-003 | No unrelated Wait leakage | Other active, historical, cancelled, and cross-Session Waits do not appear in the envelope. | security integration | release |
| EP02-004 | Snapshot immutability | A Wait replacement after routing but before admission cannot alter the already committed Delivery envelope. | concurrency + sqlite | release |
| EP02-005 | Retry byte stability | An ambiguous admission failure and restart retry use the same Activation ID and semantically identical serialized envelope. | restart + inbox contract | release |
| EP02-006 | Envelope bound | A legal maximum envelope is delivered; an oversized batch fails before inbox mutation with an inspectable terminal error and no partial message. | boundary integration | release |
| EP02-007 | Untrusted framing | Event content containing Relay headers, JSON terminators, Markdown, or tool directives remains inside the untrusted Event field and cannot alter framing instructions. | security unit + official-dsh replay | release |
| EP02-008 | Conversation presentation | English and Chinese Sessions show one understandable Relay Event card/message without dumping avoidable internal JSON by default; advanced details remain available. | browser + official-dsh | release |

## EP-03: Trusted Binding And Conflict Safety

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP03-001 | Valid trusted binding | A registered trusted provider binds an Event to the exact active Wait and bypasses the semantic model. | service integration | release |
| EP03-002 | Public-body spoof | Caller JSON containing `session_id`, `wait_id`, or `trusted_binding` without provider authority cannot select an owner. | protocol security | release |
| EP03-003 | Stale binding | A binding to a superseded, consumed, cancelled, or version-mismatched Wait fails closed and records the stale reason. | sqlite | release |
| EP03-004 | Cross-Session mismatch | A valid Wait ID paired with the wrong Session ID cannot create a Delivery or claim either Wait. | sqlite security | release |
| EP03-005 | One exclusive exact match | One active exclusive Wait with the exact type is delivered once. | unit + integration | release |
| EP03-006 | Conflicting exclusive matches | Two Sessions with exclusive exact matches produce deterministic escalation, independent of insertion order, with no Wait claim. | randomized-order integration | release |
| EP03-007 | Non-exclusive fan-out | Multiple non-exclusive exact matches create one Delivery per Session atomically and preserve per-Session matched cards. | sqlite | release |
| EP03-008 | Mixed exclusivity | A candidate set mixing exclusive and non-exclusive ownership cannot fan out; the explicit conflict disposition and evidence are inspectable. | contract integration | release |
| EP03-009 | Bound Monitor route | A validated bound Monitor trigger never invokes Semantic Router, even while Router is configured and returning a conflicting answer. | composition | release |
| EP03-010 | Conflict UI | The management UI labels binding failures and exclusive conflicts in both locales and offers no unsafe “deliver anyway” shortcut. | browser | release |

## EP-04: Production GitHub Connector

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP04-001 | Signed pull-request webhook | A real HTTP request with valid GitHub HMAC is durably accepted, normalized, bound, and acknowledged only after persistence. | protocol + sqlite | release |
| EP04-002 | Supported event matrix | Sanitized fixtures for pull request, review, check run, check suite, and workflow run normalize canonical subject, head SHA, action, outcome, and provider identity. | fixture contract | release |
| EP04-003 | Invalid signature matrix | Missing, malformed, wrong-secret, wrong-algorithm, body-mutated, and truncated signatures return stable refusal without parsing or persistence. | protocol security | release |
| EP04-004 | Replay and redelivery | Same delivery ID/body and provider redelivery create one Event; same delivery ID with conflicting body fails closed and is audited. | protocol + sqlite | release |
| EP04-005 | Push/poll convergence | Webhook and Monitor observations for the same repository/PR/SHA/transition converge on one trigger and Delivery. | connector-monitor composition | release |
| EP04-006 | Unsupported event | A correctly signed unsupported GitHub event becomes a durable dismissed record with no Session wake and an honest HTTP response. | protocol | release |
| EP04-007 | Deleted or transferred repository | Repository unavailable, renamed, transferred, or installation removed produces a stable source error without leaking token or retrying forever. | provider-compatible protocol | release |
| EP04-008 | Request bounds | Fixed-length, chunked, compressed, malformed JSON, wrong content type, and one-byte-over-limit requests are rejected without excessive allocation. | protocol boundary | release |
| EP04-009 | Secret lifecycle | Configure, rotate, revoke, and restart preserve verification behavior; UI/API never returns the secret after creation and logs contain no secret fragments. | integration + browser log audit | release |
| EP04-010 | Connector UI | GitHub status, last successful delivery, last error class, webhook URL, copy action, rotate/revoke confirmations, and remediation render in both locales and keyboard flows. | browser | release |
| EP04-011 | Controlled live webhook | A controlled repository action reaches the packed Connector over HTTP and wakes the intended existing DSH Session once. | controlled-live + official-dsh | release |

## EP-05: GitHub Pull-Request Monitor

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP05-001 | Baseline activation | A valid repository/PR baseline persists before Wait replacement and records canonical PR, SHA, checks, review, and merge state. | provider-compatible integration | release |
| EP05-002 | Unchanged poll | Repeated semantically identical responses with reordered arrays and volatile metadata create checks but zero Event, Delivery, and model turn. | sqlite + fake provider | release |
| EP05-003 | Failed check transition | A newly failed required check emits one compact bound Event naming the check and SHA without embedding raw logs. | integration | release |
| EP05-004 | Checks become green | Pending-to-success transition emits the configured actionable/terminal Event exactly once. | integration | release |
| EP05-005 | Review transition | Review requested, changes requested, approval, dismissal, and review on an old SHA are classified deterministically. | detector matrix | release |
| EP05-006 | New revision epoch | A head SHA change clears revision-scoped dedupe, establishes the new epoch, and does not replay old failures. | sqlite | release |
| EP05-007 | Terminal PR states | Merged, closed-unmerged, and repository-deleted outcomes record distinct terminal reasons and complete or fail according to policy. | integration | release |
| EP05-008 | Provider error budget | Authentication, permission, rate limit, timeout, transient 5xx, malformed response, and not-found errors follow bounded backoff and visible degraded/failed transitions. | fake clock + sqlite | release |
| EP05-009 | Restart lease recovery | Restart during observation, after observation before commit, and after trigger commit before admission never runs two concurrent probes or duplicates the Event. | process restart | release |
| EP05-010 | Webhook race | Webhook arriving while a poll lease is active produces one durable transition regardless of completion order. | concurrency integration | release |
| EP05-011 | Controlled live polling | Packed Monitor queries a controlled repository through the real GitHub API boundary and detects one sanitized state transition. | controlled-live | release |
| EP05-012 | Monitor UI details | Current SHA, objective, health, last/next check, last meaningful transition, rate-limit state, and terminal reason render correctly in both locales. | browser | release |

## EP-06: Same-Session And Same-Backend Continuity

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP06-001 | Native DSH continuation | Event delivery reuses the exact existing DSH Session ID and does not create, dispose, select, or rename a Session. | official-dsh | release |
| EP06-002 | Codex Thread continuation | A Codex-backed Session records the same Codex Thread ID before registration and after Event-triggered continuation. | official-dsh + protocol trace | release |
| EP06-003 | Claude session continuation | A Claude-backed Session records the same backend session identity across delivery. | official-dsh + protocol trace | release |
| EP06-004 | Busy Session ordering | A user turn in progress receives the Relay follow-up through normal inbox ordering without interruption, lost user input, or priority inversion. | official-dsh concurrency | release |
| EP06-005 | Unselected completion | Background work in another Session never navigates the UI; its unread/completion state remains visible until opened. | browser | release |
| EP06-006 | Ambiguous durable acknowledgement | Failure before flush retries; failure after flush discovers the existing Activation message and does not append a duplicate. | fault injection + restart | release |
| EP06-007 | Host and backend restart matrix | Restart Events, DSH Host, and backend individually at each admission boundary; the original binding recovers or reaches a visible terminal failure. | process matrix | release |
| EP06-008 | Missing Session/backend | Deleted Session, archived/unavailable Session, missing Codex Thread, and unavailable model produce distinct terminal states without creating replacements. | official-dsh fault injection | release |
| EP06-009 | Presentation continuity | Existing history, running state, streamed output, approvals, and final completion remain visible after Event continuation in both locales. | browser + backend trace | release |

## EP-07: Complete Monitor Lifecycle

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP07-001 | Create and durable arm | Agent request reports success only after Wait, baseline, Monitor, and schedule are durably committed. | integration | release |
| EP07-002 | Create failure honesty | Missing observer, failed baseline, invalid capability, and storage failure retain the prior Wait set and return an explicit not-armed result. | fault injection | release |
| EP07-003 | Inspect | Agent tool and UI return consistent owner, target, state, next/last check, observation summary, trigger, failures, budgets, and terminal reason. | contract + browser | release |
| EP07-004 | Cadence-only update | Updating cadence and budgets preserves baseline/fingerprint and computes the next due time without an immediate duplicate trigger. | fake clock + sqlite | release |
| EP07-005 | Target/objective update | Changing target or objective creates a new baseline epoch atomically; baseline failure leaves the old Monitor unchanged. | integration | release |
| EP07-006 | Pause and resume | Pause releases leases and prevents due checks; resume retains baseline and schedules exactly one next check across restart. | sqlite + restart | release |
| EP07-007 | Run now concurrency | Run-now executes immediately when idle and returns busy when leased, without shifting cadence unless specified. | concurrency | release |
| EP07-008 | Recurring rearm | Triggered recurring Monitor accepts only an explicit replacement Wait/rearm and never replays its previous trigger identity. | integration | release |
| EP07-009 | Stop evidence | Agent/user stop records actor, localized reason code, free-text detail, and time; no later scheduled check runs. | sqlite + browser | release |
| EP07-010 | Supersede/cancel race | Wait replacement, cancel, run-now, and trigger commit races resolve atomically with no orphan Monitor or consumed wrong Wait. | randomized concurrency | release |
| EP07-011 | Bilingual interaction | Create status, pause/resume, run-now, stop confirmation, validation, and stale-state conflict flows are complete in English and Chinese with keyboard operation. | browser | release |

## EP-08: Visible Terminal Failure And Escalation

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP08-001 | Router retry exhaustion | Timeout/invalid output uses the configured budget, persists every attempt, then commits escalation rather than leaving Event in routing. | fake model + sqlite | release |
| EP08-002 | Delivery retry exhaustion | Repeated inbox refusal preserves stable identities, follows backoff, and ends in a visible terminal delivery failure with notification attempt. | fake clock + restart | release |
| EP08-003 | Monitor failure | Consecutive observer failure emits one `monitor.failed`, leaves the business Wait active, and records degraded then failed evidence. | integration | release |
| EP08-004 | Deadline outcome | Wait deadline executes `on_timeout` as a bound Event or escalation exactly once across restart. | timer integration | release |
| EP08-005 | Notification success | Escalation invokes the configured provider once with a bounded localized summary and stores provider receipt identity. | provider contract | release |
| EP08-006 | Notification unavailable/failure | Missing or failing provider does not undo the Event terminal state; UI prominently shows notification unavailable/failed and allows safe retry. | integration + browser | release |
| EP08-007 | No unsafe conversation creation | Every escalation and failure matrix leaves the DSH Session inventory unchanged. | official-dsh | release |
| EP08-008 | Stuck-state watchdog | Seeded Events in every nonterminal state beyond their lease/retry deadline are recovered or terminalized; none remain silently stuck. | sqlite recovery | release |
| EP08-009 | Error privacy | User-facing errors are actionable but contain no stack, token, raw credential, private attachment, database path, or unrelated Session content. | snapshot + log audit | release |
| EP08-010 | Failure UI | Error class, affected source/Wait, attempts, last time, notification result, remediation, retry/open/cancel controls render in both locales and survive refresh. | browser | release |

## EP-09: Pull-Request Waiting Workflow

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP09-001 | Happy-path arm | From a repository-backed root Agent, one high-level call resolves repository/PR/current SHA, registers continuation and Monitor, and returns a durable armed receipt. | official-dsh + controlled provider | release |
| EP09-002 | Identity authorization | A subagent, hook Session, cron Session, forged Session argument, or mismatched project cannot arm or mutate the root Session's workflow. | Host security contract | release |
| EP09-003 | Invalid target | Non-GitHub URL, malformed PR, repository outside project policy, inaccessible PR, and head mismatch fail before replacing existing Waits. | validation + provider fake | release |
| EP09-004 | CI failure continuation | A failed check wakes the original Session with matched continuation; Agent can identify the failing check and next action without reconstructing the Wait from history. | official-dsh replay | release |
| EP09-005 | New push cycle | After a simulated fix/push, the workflow binds a replacement Wait to the new SHA and does not accept late results for the previous SHA as current success. | end-to-end integration | release |
| EP09-006 | Green and reviewed completion | Required checks plus configured review condition complete the Monitor, consume the current Wait, and present a success notification without another idle poll turn. | end-to-end integration | release |
| EP09-007 | Closed/merged branches | Merged, closed without merge, force-pushed, draft-converted, and permission-lost paths use distinct continuation/failure outcomes. | workflow matrix | release |
| EP09-008 | Cap is not success | Check/runtime/token caps produce an explicit exhausted outcome and never report the PR objective as complete. | fake clock/budget | release |
| EP09-009 | Tool presentation | Agent tool result clearly distinguishes requested, armed, already-watching, updated, and failed states in English and Chinese renderers. | official-dsh browser | release |
| EP09-010 | Real closed loop | Packed release opens or selects a controlled PR, waits, receives a real webhook or poll change, continues the same Codex Thread, registers the next phase, and completes without manual Relay API calls. | controlled-live + official-dsh | release |

## EP-10: Installation, Configuration, And Doctor

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP10-001 | Clean install | Documented commands install exact packed versions into a fresh supported DSH profile and boot Events-only, Events+Monitors, and full composition. | official-dsh | release |
| EP10-002 | Read-only healthy doctor | Doctor verifies package identities, storage, schema, resolver, inbox, scheduler, connector, notification, locale/timezone, and optional Router; exits zero without mutating business records. | CLI integration | release |
| EP10-003 | Machine-readable doctor | JSON output has a versioned schema, stable check IDs/severity, redacted details, remediation, and non-zero exit for blocking failures. | contract test | release |
| EP10-004 | Failure matrix | Missing plugin, wrong API version, unwritable database, locked/corrupt database, unavailable DSH, missing GitHub scope, bad webhook secret configuration, stopped scheduler, missing model, and missing notifier identify the exact failed layer. | isolated fault matrix | release |
| EP10-005 | Disposable protocol probe | An explicitly selected probe uses uniquely tagged temporary records, proves ingress-to-inbox behavior, and cleans only those records even after partial failure. | official-dsh | release |
| EP10-006 | Sleep/restart explanation | Doctor detects or explains local scheduler limitations and overdue recovery behavior without claiming monitoring continues while the host is powered off. | CLI snapshot | release |
| EP10-007 | Secret redaction | Text/JSON doctor output, debug logs, errors, and support bundle contain no configured secret or recognizable substring. | seeded-secret scan | release |
| EP10-008 | Bilingual CLI | Help, healthy summary, every failure class, remediation, and confirmation prompt are complete in English and Chinese; JSON stays locale-neutral. | CLI snapshots | release |
| EP10-009 | Upgrade and rollback check | Doctor detects pending migration, validates backup/compatibility prerequisites, and refuses unsupported downgrade without modifying the database. | migration integration | release |
| EP10-010 | Documentation execution | Every published install, configure, rotate, doctor, upgrade, and uninstall command is executed verbatim in a clean environment. | docs-as-tests | release |

## EP-11: Unattended Security And Resource Boundaries

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP11-001 | Source token rotation/revocation | Old/new overlap follows policy, revoked material immediately fails, restart preserves state, and no response reveals stored secrets. | protocol + restart | release |
| EP11-002 | Replay resistance | Duplicate provider IDs deduplicate; timestamp/signature replay policy rejects stale signed requests where configured; conflicting reuse fails closed. | protocol security | release |
| EP11-003 | Rate and concurrency limits | Per-source and global limits reject or queue excess work predictably without starving management/health endpoints or corrupting leases. | load integration | release |
| EP11-004 | Monitor budget boundaries | Minimum cadence and maximum runtime/check/error/Event limits enforce exact boundary values and terminalize one-over-limit cases. | fake clock/property tests | release |
| EP11-005 | Capability rejection | Generated JS, shell, arbitrary command, unrestricted browser, arbitrary URL/network, write API, and raw secret requests are rejected before baseline or persistence. | security unit + contract | release |
| EP11-006 | Project credential isolation | A Monitor/Connector for project A cannot reference project B credentials, Waits, repositories, artifacts, or Session context. | multi-project integration | release |
| EP11-007 | Payload and decompression bounds | Fixed, chunked, compressed, nested, many-key, deep JSON, Unicode expansion, and attachment metadata bombs stay within CPU/memory/size policy. | protocol resource test | release |
| EP11-008 | Redaction matrix | Tokens in URL, headers, JSON, errors, continuation artifacts, provider response, stack, and UI are redacted in logs, database inspection output, notification, doctor, and screenshots. | seeded-secret scan | release |
| EP11-009 | Retention safety | Cleanup removes only eligible terminal detail, retains unresolved and policy-required evidence, is restart-safe, and reports counts without exposing content. | sqlite + fault injection | release |
| EP11-010 | Dependency and package audit | Packed packages contain no `.env`, database, logs, fixtures with credentials, private source paths, undeclared runtime dependency, or install script mutation. | tarball/static audit | release |

## EP-12: Release-Grade Waiting And Monitor Management UI

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP12-001 | Live and historical list | Waits, Monitors, Events, Deliveries, Activations, decisions, notifications, and terminal reasons render with consistent status and owner links. | browser | release |
| EP12-002 | Empty/loading/unavailable/error | Each state is visually distinct, localized, keyboard reachable where actionable, and never presents stale success controls. | browser | release |
| EP12-003 | Pagination and stable refresh | More than one page preserves sorting, filters, selected row, focus, and scroll across background refresh without duplicates or omissions. | browser seeded data | release |
| EP12-004 | Open Session | Open navigates only after user activation to the exact owning Session; missing/deleted Session presents remediation and leaves current navigation unchanged. | browser + official-dsh | release |
| EP12-005 | Check now/pause/resume | Controls show pending, prevent duplicate submission, refresh from authoritative state, and handle provider missing, busy lease, stale version, and server error. | browser fault matrix | release |
| EP12-006 | Retry | Retry is offered only for retryable terminal/queued states, reuses durable identities where required, and cannot duplicate a committed Delivery. | browser + sqlite | release |
| EP12-007 | Destructive confirmation | Cancel/stop names the exact target and effect; Escape/cancel restores focus; confirm cannot act on a stale/replaced record without a conflict response. | browser | release |
| EP12-008 | Long and hostile content | Long IDs, Chinese/English summaries, bidi text, emoji, HTML, Markdown, script tags, and Relay-looking headers wrap or escape without XSS or layout overflow. | browser security | release |
| EP12-009 | Responsive baseline | 1280x720 and 1440x900 show primary status/actions without horizontal page scroll; dialogs fit viewport and tables expose intentional local scrolling only. | screenshot geometry | release |
| EP12-010 | Accessibility | Landmarks, headings, table semantics, dialog naming/trap/return focus, live status, contrast, button names, and keyboard order pass automated and scripted checks. | browser a11y | release |
| EP12-011 | Locale switch | Every label, status, reason, validation, tooltip, dialog, toast, date, duration, and empty state switches between English and Chinese without reload-only inconsistencies. | browser | release |
| EP12-012 | Background behavior | A completion in an unselected Session updates counts/unread state without stealing navigation, focus, active dialog, or form input. | browser concurrency | release |

## EP-13: Durable Timer And Deadline

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP13-001 | Relative timer | Positive whole-second delay persists one computed UTC deadline and fires one bound `timer.elapsed` Event at or after due time. | fake clock + sqlite | release |
| EP13-002 | Absolute timer | RFC3339 input with explicit timezone normalizes to UTC, displays in selected timezone, and retains original intent metadata. | unit + browser | release |
| EP13-003 | Invalid time matrix | Zero/negative/fractional/overflow relative values, invalid date, DST gap/overlap without offset, timezone-less absolute input, and past time without explicit immediate policy fail before persistence. | boundary unit | release |
| EP13-004 | Overdue restart | Restart before due, exactly due, after due, and after trigger commit results in one Event and no lost/duplicate timer. | process restart | release |
| EP13-005 | Cancel/update race | Cancel or deadline update racing the scheduler has one serializable outcome and never fires an old deadline after successful mutation. | concurrency + fake clock | release |
| EP13-006 | Wait timeout continuation | A Wait deadline delivers the exact `on_timeout` continuation without claiming that its business Event occurred. | integration | release |
| EP13-007 | Host clock movement | Backward/forward wall-clock changes, monotonic scheduling, and restart reconciliation do not double fire or postpone an already overdue timer indefinitely. | fake clock | release |
| EP13-008 | Timer UI | Absolute/local time, timezone, relative duration, overdue state, next check, cancellation, and timeout outcome render correctly in English and Chinese. | browser | release |

## EP-14: Production Semantic Routing

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP14-001 | Bound bypass | Trusted bound Events never invoke the configured model and retain deterministic route evidence. | composition | release |
| EP14-002 | Correct semantic delivery | Sanitized email fixtures without reliable correlation select the expected existing Session/Wait and commit one Delivery. | fixture evaluation + sqlite | release |
| EP14-003 | Candidate privacy | Prompt contains only bounded routable context and excludes full continuation, unrelated Sessions, credentials, private context map, raw attachment content, and historical inactive Waits. | captured fake model request | release |
| EP14-004 | Tool and instruction isolation | Model request has no tools; email/IM text containing system prompts, JSON decisions, tool calls, or policy overrides remains evidence only. | fake model/security fixtures | release |
| EP14-005 | Exclusive conflict | Model multi-target exclusive output, unknown Session/Wait, inactive Wait, duplicate target, and stale snapshot are rejected before commit. | contract + sqlite | release |
| EP14-006 | Escalate/dismiss policy | Actionable unmatched and unresolved conflict escalate; only positively non-actionable fixtures dismiss; no result creates a Session. | evaluation + official-dsh inventory | release |
| EP14-007 | Timeout/invalid/cancel matrix | Timeout, malformed JSON, schema error, provider 429/5xx, unload cancellation, and retry exhaustion preserve attempts and eventually reach configured terminal handling. | fake model + fake clock | release |
| EP14-008 | Telemetry integrity | Model route, prompt version, candidate epoch, attempts, latency, input/cache/output tokens, evidence, and summary persist without hidden reasoning or sensitive payload. | sqlite audit | release |
| EP14-009 | Quality gates | Fixed sanitized regression set meets declared actionable coverage, target recall, exclusive misroute, unnecessary escalation, duplicate, latency, and token gates; labels never enter live routing. | reproducible evaluation report | release |
| EP14-010 | Configuration UI/doctor | Missing/invalid model leaves Events healthy on exact routing, shows one localized actionable warning, and configuration changes safely register/unregister the provider. | browser + lifecycle | release |

## EP-15: First Email Connector

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| EP15-001 | Provider push/watch ingest | A provider-compatible push/watch notification causes incremental retrieval, normalization, durable Event persistence, and acknowledgement only after the cursor/event boundary is safe. | protocol + sqlite | release |
| EP15-002 | Normalization matrix | Plain text, HTML-only, multipart, reply, forward, BCC, Unicode address/name/subject, empty subject, mailing list, automated response, and delivery failure normalize bounded canonical evidence. | sanitized fixtures | release |
| EP15-003 | Push/poll and duplicate overlap | Duplicate notifications, incremental reread, provider retry, same Message-ID with different provider ID, and cursor replay create the intended number of Events without message loss. | sqlite + provider fake | release |
| EP15-004 | Cursor recovery | Restart, expired cursor, invalid cursor, partial page, rate limit, and page failure resume from a safe checkpoint or perform a bounded resync with visible status. | process restart | release |
| EP15-005 | Attachment safety | Supported metadata/summary is bounded; executable, encrypted, oversized, nested archive, failed download, failed summary, and unknown MIME remain inspectable metadata and are never executed. | fixture/security integration | release |
| EP15-006 | Correlated reply | Reliable provider thread evidence routes deterministically to the bound Wait without a model call. | connector-events composition | release |
| EP15-007 | Uncorrelated reply | Missing/broken thread evidence invokes Semantic Router and reaches expected deliver/escalate/dismiss outcomes without treating email instructions as policy. | connector-router composition | release |
| EP15-008 | Credential and push identity lifecycle | Connect, insufficient scope, refresh, revoke, provider revocation, restart, fixed-gateway token, and Google Pub/Sub OIDC signature/issuer/audience/service-account/time/JWKS failures never expose credentials and produce clear localized remediation. | provider contract + RSA/JWKS security + browser | release |
| EP15-009 | Sender/content privacy | Logs, telemetry, doctor, screenshots, notification previews, and error messages follow configured redaction/preview policy for addresses, bodies, quoted history, and attachments. | seeded-private-data scan | release |
| EP15-010 | Connector UI | Connection health, mailbox/account label, last sync, cursor health, last error, pause/resume, disconnect confirmation, and privacy explanation render and operate in both locales. | browser | release |
| EP15-011 | Controlled live email | A sanitized controlled mailbox reply reaches the packed Connector, routes to the intended existing Session, resumes once, and survives provider redelivery. | controlled-live + official-dsh | deployment-certification |

## Requirement Traceability

Each implementation PR or small delivery change must list:

1. affected `EP-*` requirements;
2. affected scenario IDs;
3. SPEC and public-contract changes;
4. tests added or changed at each required evidence layer;
5. the test-review record proving coverage and execution validity;
6. intentionally deferred scenarios, which keep the requirement unreleased.

No requirement is marked delivered while any of its `release` scenarios is deferred,
skipped, conditionally passed, or executed only against workspace source when its
evidence column requires a packed or official-DSH environment. A pending
`deployment-certification` scenario must remain disclosed in release status and must
not be represented as provider-live evidence, but it does not block publication.
