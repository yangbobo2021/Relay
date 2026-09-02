# Monitor Bundle Platform Specification

Status: Delivery specification

## Purpose

Relay must let an Agent discover reusable Monitor capabilities, instantiate a
plugin-provided Monitor Bundle, or author a task-scoped Bundle when no registered
type satisfies the task. Relay then validates, versions, persists, schedules, and
executes the Bundle independently of the Agent turn and emits a durable Event into
the same existing DSH Session when the declared condition occurs.

This is an extensible monitoring platform. Relay Core must not accumulate one
hard-coded observer for every provider or business condition.

The normative delivery scenarios are in
[`../acceptance/monitor-bundle-platform-scenarios.md`](../acceptance/monitor-bundle-platform-scenarios.md).

## Product Boundary

The platform has two authoring paths and one execution path:

1. A plugin registers a reusable, versioned Monitor Bundle Type.
2. An authenticated root Agent creates an immutable Session- or project-scoped
   custom Monitor Bundle.
3. Both become the same persisted `MonitorVersion`, use the same lifecycle and
   budgets, and emit Events through the same atomic Relay trigger path.

Plugins may register trusted capability providers, but they do not bypass Monitor
ownership, persistence, idempotency, lifecycle, or audit rules. Agent-authored code
never receives direct host authority.

## MB-01: Public Bundle Type Registry

Monitors exposes a versioned public registry service. A plugin may register a Bundle
Type containing:

- a globally stable lowercase `type_id` and positive integer `bundle_version`;
- source plugin identity and version;
- complete `en-US` and `zh-CN` name, description, permission explanation, and
  remediation text;
- declared Event types;
- a bounded JSON parameter schema;
- required capability names and configuration health requirements;
- lifecycle, schedule, retry, expiry, and resource-policy defaults;
- an immutable implementation artifact or a deterministic factory that produces one;
- supported prior versions and an explicit migration function or incompatibility
  result.

Registration is atomic. Duplicate identities, incompatible API versions, malformed
schemas, undeclared Events, and incomplete locales fail without replacing a healthy
registration. Registration returns an idempotent disposer. A disposed or unloaded
plugin disappears from discovery immediately but never silently deletes persisted
Monitor instances.

## MB-02: Dynamic Capability Catalog

Relay exposes the currently supported Bundle Types through the service, Agent tool,
and management UI. This catalog is computed from live registrations and current
project authorization; it is never a hard-coded documentation list.

Each entry reports `type_id`, version, origin, provider plugin, declared Event types,
parameter schema, capability summary, supported lifecycle, configuration status,
and localized explanation. Status is one of `available`, `configuration_required`,
`unavailable`, or `incompatible`. Secret handles and credential values never appear.

The Bundle Type Catalog answers “what can be created.” Monitor instance management
answers “what is already running.” The two surfaces must not be conflated.

## MB-03: Plugin Bundle Instantiation

An authenticated root Agent may instantiate an available registered type with typed
parameters, schedule/lifecycle overrides inside policy, and a Wait continuation.
Session ownership is derived from the authenticated tool context. The Agent cannot
supply another Session ID or elevate the type's capabilities.

Relay asks the type factory for a normalized Bundle, validates it, records a baseline,
and atomically persists the Wait, Monitor, and immutable version. A configuration,
factory, validation, capability, or baseline failure changes no prior Wait set.

## MB-04: Agent-Authored Custom Bundles

When no registered type satisfies a task, an authenticated root Agent may propose a
custom Bundle. A custom Bundle is scoped to the current Session or current project,
has an expiry, declares every Event and capability it may use, and contains no raw
credential. A project-scoped Bundle may be reused only inside the canonical project
boundary and only after the same authorization checks.

Validated custom Bundles appear in discovery with `origin: agent`, their exact scope,
artifact hash, creator Session, reusability, and expiry. They never become global
capabilities implicitly.

## MB-05: Monitor Bundle v1 Contract

A v1 custom Bundle is a bounded manifest plus one immutable module artifact. The
Agent-supplied manifest contains:

- `contract_version: 1`, a `custom.*` `type_id`, and Session/project scope;
- declared Event types and stable trigger-key contract;
- schedule, one-shot/recurring behavior, retry, expiry, and budgets;
- requested capabilities with resource-scoped arguments;
- observation schema and Event data schema;
- baseline behavior and sanitized presentation metadata.

After validation Relay derives the instance ID, origin, source SHA-256, full version
SHA-256, runtime authorization, and immutable version record; these cannot be supplied
as alternate ownership by the Agent.

The script assigns exactly `{ observe(context), detect(previous, current) }` to
`globalThis.monitor`.
`observe` receives only a brokered context assembled from the approved manifest.
`detect` receives bounded JSON values, has no capabilities, and deterministically
returns zero or more `{ type, key, data }` proposals. Relay validates Event type,
stable key, size, depth, and JSON shape before commit.

Artifacts are copied into Relay-owned content-addressed storage before activation.
Editing or deleting the project source cannot mutate an active version. An update
creates a new version and retains prior evidence.

## MB-06: Sandbox And Capability Broker

Agent-authored modules execute outside the Relay and Agent JavaScript realms in a
runtime that has no ambient environment variables, filesystem, network stack,
process API, module loader, native code, timers, randomness, clock, credentials, or
Relay database handle. A plain Node `vm` or ordinary child process with user
permissions is not an accepted production boundary.

All effects cross a versioned Capability Broker. A capability request names a
registered provider, an operation, and resource arguments that are a subset of the
approved manifest. Providers enforce project/Session ownership, read-only defaults,
target allowlists, deadlines, cancellation, response bounds, and secret handles.
Mutation, outbound messaging, arbitrary command execution, and unrestricted browser
or network access are not Monitor capabilities.

Every sandbox run has CPU, memory, wall-clock, output-byte, and Event-count budgets.
Contract v1 has no logging API and permits exactly one broker request per observation,
which fixes both the log-byte and broker-call budgets at zero and one respectively.
Timeout, crash, invalid output, denied capability, and provider failure produce stable
redacted check outcomes and follow the persisted retry policy.

## MB-07: Capability Provider Extension

Plugins may register versioned Capability Providers independently of Bundle Types.
A provider declares its operations, parameter/result schemas, read/mutate class,
authorization hook, health, and cancellation behavior. Duplicate providers and
schema/version conflicts fail closed.

Removing a provider prevents new checks and moves affected instances to an
inspectable `provider_unavailable` degraded state. Reinstalling a compatible provider
allows recovery without replacing the Wait or replaying the last trigger.

## MB-08: Built-In Capability Migration

Time and GitHub polling are reference Bundle extensions, not hard-coded Core behavior.

- A Time Bundle extension registers `time.deadline`, the `clock.read` capability,
  and the high-level `relay_schedule_timer` convenience tool.
- A GitHub Monitor Bundle extension registers `github.pull-request`, its read-only
  capability/factory, and the high-level `relay_watch_github_pull_request` tool.
- The GitHub webhook Connector remains a push source and may converge with the
  GitHub polling Bundle through the existing Event correlation contract.

Installing Core alone exposes neither type nor convenience tool. Installing or
unloading an extension updates discovery and tools without restarting DSH. Existing
persisted timers and GitHub Monitors migrate without loss or become visibly
`provider_unavailable` until their extension is installed.

## MB-09: Process Observation Reference Slice

The first Agent-authored vertical slice observes a process identity. The broker uses
a host-issued Process Handle containing host identity, PID, and process start identity;
raw PID alone is insufficient because PIDs are reused. The read-only operation reports
`running` or `exited` and may report an exit code only when the provider owns reliable
parent/supervisor evidence.

The custom Bundle observes `running -> exited`, emits one `process.exited` Event with
a stable key derived from the Process Handle, and resumes the same Session. Missing,
unauthorized, reused, or unverifiable process identities fail closed rather than
claiming that the process exited.

## MB-10: Agent Authoring Skill

Relay ships a discoverable `relay-monitor-author` Skill. It first queries the live
Bundle Type Catalog and prefers an available plugin type. Only when no type satisfies
the task does it scaffold a custom Bundle, request the minimum capability, generate
fixtures, run the deterministic validator, and call the public validation/install
tools.

The Skill contains no credentials and never treats generated prose as successful
installation. It reports the durable Monitor ID, artifact hash, approved capabilities,
next check, expiry, and stop/repair instructions returned by Relay.

## MB-11: Management And Localization

The management UI exposes a localized Bundle Type Catalog and separates it from
Monitor instances. It shows type/version/origin/provider, declared Events,
configuration status, permission explanation, scope, artifact hash, lifecycle,
next/last check, last trigger, and stable error/remediation.

English and Simplified Chinese support, keyboard operation, focus, screen-reader
names, loading/empty/error states, narrow/wide layout, dark/light contrast, pagination,
and secret redaction are release requirements.

## MB-12: Release And Compatibility

Core, extension plugins, Skill, and public contracts are independently packable and
versioned. Packages import only public entrypoints. A release records exact package
hashes, official DSH commit, catalog contents, sandbox implementation/version, and
executed scenario IDs.

No feature is delivered when its required negative, restart, packed, official-DSH,
browser, or end-to-end evidence is skipped. A test review must prove both that the
scenario set is sufficient for release and that the tests fail when the relevant
guard is intentionally broken.
