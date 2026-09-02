# Monitor Bundle Platform Delivery Acceptance Scenarios

Status: Normative release index

These scenarios qualify
[`../spec/monitor-bundle-platform.md`](../spec/monitor-bundle-platform.md). Every row
marked `release` is required before publication. Evidence follows
[`test-review-protocol.md`](test-review-protocol.md).

## Evidence Environments

- `unit`: deterministic module test with fake clock and IDs.
- `sqlite`: temporary on-disk database, including reopen where stated.
- `sandbox`: production sandbox implementation, not a same-realm mock.
- `packed`: tarballs installed without workspace resolution.
- `official-dsh`: fresh profile at a recorded immutable upstream commit.
- `browser`: real bundled management UI with console/network/accessibility assertions.
- `controlled-live`: sanitized real operating-system or provider behavior.

## Catalog And Registry

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MB01-001 | Empty Core catalog | Core without extensions lists zero Bundle Types and still lists persisted instances separately. | unit + official-dsh | release |
| MB01-002 | Plugin registration | A plugin registers one complete localized type and it immediately appears through service, Agent tool, and UI. | integration + browser | release |
| MB01-003 | Multiple types | Several plugins and several types per plugin have stable deterministic ordering and pagination. | randomized integration + browser | release |
| MB01-004 | Duplicate identity | Same type/version and conflicting provider/version registrations fail without replacing the first registration. | unit + lifecycle | release |
| MB01-005 | Invalid definition matrix | Invalid ID/version, schema, Events, defaults, capabilities, factory, locale, and API version each fail before visibility. | table-driven unit | release |
| MB01-006 | Idempotent disposal | Disposal twice is safe; the first disposal removes only the owning registration and convenience tools. | lifecycle | release |
| MB01-007 | Hot install/uninstall | Catalog changes without DSH restart and concurrent listing never exposes partial records. | official-dsh | release |
| MB01-008 | Authorization filtering | Catalog differs by project/Session authorization without leaking hidden type metadata. | security integration | release |
| MB01-009 | Configuration states | Available, configuration-required, unavailable, and incompatible are distinct and include localized remediation. | integration + browser | release |
| MB01-010 | Secret-safe discovery | Catalog, Doctor, UI, logs, and exported diagnostics contain no credential value or secret-handle identifier. | seeded-secret scan | release |

## Plugin Bundle Instantiation

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MB02-001 | Valid instance | Root Agent instantiates an available type; normalized Bundle, baseline, Wait, Monitor, and version commit atomically. | integration + sqlite | release |
| MB02-002 | Session derivation | Agent tool has no Session parameter and subagent/caller fields cannot select another owner. | official-dsh contract | release |
| MB02-003 | Typed parameters | Boundary-valid English, Chinese, Unicode, numeric, enum, array, and object parameters pass; one-over and unknown fields fail. | generated-schema tests | release |
| MB02-004 | Policy narrowing | Agent may reduce cadence/capability scope only within type policy and cannot elevate provider authority. | security unit | release |
| MB02-005 | Factory failure | Throw, timeout, invalid Bundle, oversized artifact, and undeclared Event leave the previous Wait set unchanged. | integration | release |
| MB02-006 | Baseline failure | Capability/configuration/provider/baseline errors commit no partial type instance, Wait, or Monitor. | fault injection + sqlite | release |
| MB02-007 | Concurrent create | Duplicate concurrent instance requests converge on one immutable version and one baseline. | concurrency + sqlite | release |
| MB02-008 | Plugin upgrade | Compatible migration creates a new version; incompatible upgrade remains visible and does not execute old code under new authority. | packed upgrade | release |
| MB02-009 | Plugin unload with live instances | Instances become inspectably degraded; no checks run and no Wait is lost or falsely claimed. | lifecycle + restart | release |
| MB02-010 | Compatible reinstall | Reinstall resumes from last observation without initial replay or duplicate Event. | lifecycle + sqlite | release |

## Agent-Authored Custom Bundles

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MB03-001 | Session-scoped custom Bundle | Agent validates and installs a Bundle visible only to its Session, with hash, creator, expiry, and origin. | integration | release |
| MB03-002 | Project-scoped custom Bundle | Canonical project scope permits reuse inside and rejects sibling, parent-prefix, symlink, and missing-cwd escape. | filesystem security | release |
| MB03-003 | Required expiry | Missing, past, excessive, invalid-zone, and overflow expiry fail before artifact persistence. | boundary unit | release |
| MB03-004 | Immutable source | Edit/delete/replace of source after install does not alter active artifact or hash. | filesystem + sqlite | release |
| MB03-005 | Content convergence | Identical content converges to one artifact; different content under reused identity creates a new version or fails explicitly. | concurrency + artifact store | release |
| MB03-006 | Declared Events only | Module output outside declared Event types is rejected and records no Trigger/Event. | sandbox + sqlite | release |
| MB03-007 | Stable trigger key | Empty, oversized, repeated, or conflicting keys follow the exact idempotency contract. | property + sqlite | release |
| MB03-008 | Observation/Event schemas | Null, wrong type, extra field, deep, broad, cyclic-equivalent, and oversized values fail before commit. | sandbox boundary | release |
| MB03-009 | Update and rollback | Valid update retains history; failed update leaves old version active; explicit rollback cannot expand capabilities. | sqlite + lifecycle | release |
| MB03-010 | Expiry cleanup | Expired Bundle stops checks, retains terminal evidence, and cleans unreferenced artifacts without deleting shared content. | fake clock + restart | release |

## Sandbox And Capability Broker

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MB04-001 | No ambient authority | Environment, filesystem, network, process, module loading, native code, host globals, clock, randomness, and Relay internals are inaccessible. | real sandbox adversarial suite | release |
| MB04-002 | Manifest subset | Every broker call must be a schema-valid subset of approved provider/operation/resources. | security property tests | release |
| MB04-003 | Read-only default | Mutation, command execution, outbound message, unrestricted browser, and unrestricted URL requests are rejected. | adversarial integration | release |
| MB04-004 | Secret handles | Provider resolves an authorized handle internally; raw value never enters sandbox, observation, Event, error, log, or UI. | seeded-secret scan | release |
| MB04-005 | Resource budgets | Exact CPU/memory/time/call/output/Event/log limits pass; one-over terminates with stable redacted classification. | sandbox stress | release |
| MB04-006 | Cancellation | Pause, stop, update, unload, and Host shutdown cancel the exact run and reject late broker replies/Events. | race integration | release |
| MB04-007 | Sandbox crash | Crash cannot terminate Host or corrupt database; lease recovers under bounded retry. | process isolation + restart | release |
| MB04-008 | Provider registration conflict | Duplicate ID, incompatible operation schema, mutable declaration, and invalid health hook fail closed. | unit | release |
| MB04-009 | Provider loss/recovery | Loss degrades all dependent instances once; compatible recovery continues without replay. | lifecycle + sqlite | release |
| MB04-010 | Cross-owner denial | A Bundle cannot inspect another project/Session resource even with a syntactically valid broker request. | security integration | release |

## Time Bundle Extension

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MB05-001 | Core separation | Core package/source/export/tool inventory contains no timer implementation or `relay_schedule_timer`. | package boundary | release |
| MB05-002 | Extension discovery | Installing Time adds `time.deadline`, localized metadata, `timer.elapsed`, `clock.read`, and convenience tool. | packed + official-dsh | release |
| MB05-003 | Relative deadline | Positive whole-second delay persists resolved UTC intent and fires once. | fake clock + sqlite | release |
| MB05-004 | Absolute deadline | RFC3339 timezone validation, past/immediate policy, DST offsets, overflow, and invalid calendar values behave explicitly. | boundary unit | release |
| MB05-005 | Restart and clock movement | Overdue restart fires once; backward time never fires early; forward time never duplicates. | process restart | release |
| MB05-006 | Unload/reinstall | Live timer degrades without provider, then resumes and preserves its original deadline after reinstall. | official-dsh lifecycle | release |
| MB05-007 | Migration | Pre-platform persisted timer upgrades to the Time type without ID, Wait, continuation, baseline, or deadline loss. | migration fixture | release |
| MB05-008 | Uninstall UI | Catalog/tool disappear while historical timer evidence remains understandable in both locales. | browser | release |

## GitHub Monitor Bundle Extension

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MB06-001 | Polling separation | GitHub Connector webhook remains usable without polling Bundle; Core has no GitHub observer. | package composition | release |
| MB06-002 | Extension discovery | Installing GitHub Bundle adds type, Events, parameter schema, permission explanation, configuration health, and convenience tool. | packed + browser | release |
| MB06-003 | PR transition matrix | Head, checks, review, draft, mergeability, open/closed/merged, and stable no-change observations classify deterministically. | provider fake | release |
| MB06-004 | Project credential scope | Repository target and credential are restricted to the canonical project policy with no cross-project fallback. | security integration | release |
| MB06-005 | Webhook convergence | Signed webhook racing or following polling produces one Trigger/Event/Delivery. | protocol + concurrency | release |
| MB06-006 | Provider failures | Auth, permission, not found, rate limit, timeout, cancellation, malformed response, pagination loop, and size limit remain redacted and recoverable. | provider contract | release |
| MB06-007 | Unload/reinstall | Webhook remains active, polling checks stop visibly, and compatible reinstall resumes without baseline replay. | official-dsh lifecycle | release |
| MB06-008 | Migration | Pre-platform GitHub Monitor upgrades without changing stable subject, head baseline, Wait, continuation, or correlation key. | migration fixture | release |
| MB06-009 | External account certification | With explicitly supplied disposable credentials, a real GitHub change wakes the same backend context exactly once. This certifies an environment; it does not replace deterministic protocol gates. | controlled-live + official-dsh | optional-certification |

## Process Capability And Dynamic Bundle Slice

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MB07-001 | Issued handle | Authorized provider issues host/PID/start identity; raw or forged PID input cannot become a capability grant. | OS integration | release |
| MB07-002 | Running baseline | Agent-authored Bundle records running baseline and emits no initial exit Event. | sandbox + controlled process | release |
| MB07-003 | Exit continuation | Process exits after Agent turn; one `process.exited` resumes the exact existing Session/backend. | controlled-live + Cordis composition | release |
| MB07-004 | Relay restart | Relay restarts between baseline and exit and still observes/delivers once. | process restart + Cordis composition | release |
| MB07-005 | PID reuse | Same PID with different start identity is `identity_lost`, not the watched process exit. | provider simulation + OS where possible | release |
| MB07-006 | Exit code evidence | Exit code is reported only with supervisor evidence; otherwise it is explicitly unavailable. | provider contract | release |
| MB07-007 | Unauthorized process | Cross-user/project/Session, malformed, stale, and missing handles fail without Event or Wait claim. | security integration | release |
| MB07-008 | Duplicate observation | Repeated exited observations and restart retries retain one Trigger/Event/Delivery/Activation. | sqlite + restart | release |
| MB07-009 | Stop race | Stop-before-exit emits nothing; exit committed before stop remains one inspectable delivery. | randomized race | release |

## Agent Tools, Skill, And UI

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MB08-001 | List tool | Root Agent receives authorized live type catalog; tool schema has no Session or credential input. | official-dsh tool contract | release |
| MB08-002 | Create-from-type tool | Typed creation returns durable instance/version/hash/next-check only after baseline and commit. | official-dsh | release |
| MB08-003 | Validate/install tools | Invalid custom Bundle cannot install; valid result identity is reused by install and cannot be swapped after validation. | TOCTOU security | release |
| MB08-004 | Tool lifecycle | Plugin install/unload adds/removes only its tools from every live root Agent; subagents receive none. | lifecycle integration | release |
| MB08-005 | DSH Skill prefers plugin | Packed Author plugin is discovered through DSH's native Skill registry; given a supported condition, it lists types and instantiates the registered type rather than generating code. | DSH registry integration + isolated forward test + official-dsh | release |
| MB08-006 | DSH Skill authors fallback | Given unsupported process-exit request plus authorized capability, the Skill loaded in DSH generates, tests, validates, and installs one Session-scoped Bundle. | isolated forward test + official-dsh | release |
| MB08-007 | DSH Skill fail-closed | Missing Monitor tools, denied capability, failed validator, or ambiguous target produces no success claim or installation. | mutation tests | release |
| MB08-011 | Author plugin lifecycle | Installing/unloading the DSH Author plugin adds/removes only `relay-monitor-author`; existing Monitors remain intact and no Codex plugin metadata is present. | packed + DSH registry lifecycle | release |
| MB08-008 | Catalog UI | English/Chinese catalog shows identity, Events, origin, status, scope, permissions, remediation, and no secrets. | browser | release |
| MB08-009 | Instance UI | Custom/plugin instances show version/hash/lifecycle/check/trigger/error and support authorized management. | browser + sqlite | release |
| MB08-010 | UI edge matrix | Empty/loading/error, long Unicode, pagination, concurrent refresh, stale mutation, plugin unload, narrow/wide, light/dark, keyboard/focus, and console/network cleanliness pass. | browser | release |

## Overall Delivery Flows

| ID | Scenario | Required result | Evidence | Gate |
| --- | --- | --- | --- | --- |
| MBE2E-001 | Plugin-preferred flow | Agent needs a deadline, discovers Time, creates it, ends turn, Relay fires once, same backend continues, and history is inspectable. | packed + official-dsh | release |
| MBE2E-002 | Dynamic fallback flow | Agent needs process exit, finds no type, Skill authors a Bundle, sandbox validation and authorization pass, restart occurs, exit wakes same backend once. | packed + sandbox + controlled-live | release |
| MBE2E-003 | Plugin extension flow | A separately packed fixture plugin hot-registers a novel Bundle Type and capability, Agent discovers/uses it, unload degrades it, and reinstall recovers it. | packed + official-dsh | release |
| MBE2E-004 | GitHub push/poll flow | Agent discovers GitHub Bundle, creates a PR Wait, and independently authenticated poll/webhook paths for one canonical transition converge on one continuation. | local HTTP + signed protocol + SQLite + official-dsh | release |
| MBE2E-005 | Least-authority failure flow | Malicious custom Bundle requests ambient/undeclared authority; validation or broker denies it, no external mutation/Event/Wait claim occurs, and UI explains safely. | adversarial sandbox + browser | release |
| MBE2E-006 | Upgrade flow | Existing timer/GitHub data upgrades to extension types, active work survives, catalog is correct, and rollback/incompatibility is explicit. | prior-version profile + official-dsh | release |
| MBE2E-007 | Packaging flow | Core, Time, GitHub Bundle, fixture extension, and DSH Author plugin install from packed artifacts with no workspace imports, Codex plugin metadata, or private/generated residue. | package audit | release |
| MBE2E-008 | Test integrity | Intentional mutations to registry conflict, sandbox authority, trigger dedupe, plugin unload, catalog freshness, and Session ownership each make their required gate fail. | mutation review | release |

## Delivery Rule

A subfunction is not delivered until every `release` row in its section passes with
the required evidence. `optional-certification` rows require credentials only when a
specific external environment is being certified; they never justify collecting a
customer mailbox or repository credential for the product release itself. The
platform is not delivered until every `MBE2E-*` row passes. A green unit suite cannot
substitute for sandbox, packed, official-DSH, browser, restart, or controlled-live
evidence named by a release scenario.
