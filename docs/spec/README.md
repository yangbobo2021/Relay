# Relay Specification

This directory is the source of truth for Relay's required behavior. Architecture
documents may describe an implementation, and decision records may explain a
choice, but neither should redefine the requirements here.

## Index

- [Product](product.md): purpose, first users, first scenario, priorities, and MVP boundaries.
- [Runtime](runtime.md): DSH ownership, Wait registration, Event delivery, and invariants.
- [Codex In DSH Web](codex-app-server.md): native DSH Session lifecycle, Codex Thread
  binding and projection, approvals, and Relay Event continuation.
- [Codex Session Import Risk Validation](codex-session-import-validation/README.md):
  risk register, reproducible experiment protocols, evidence requirements, and
  release gates for importing existing Codex Threads as DSH Sessions.
- [Claude Code In DSH Web](claude-code.md): native DSH Session lifecycle, Claude Code
  session binding and projection, CLI/SDK backend contract, and Relay Event continuation.
- [Conversation Presentation](conversation-presentation.md): default simplified Chat
  presentation and the global advanced-debugging disclosure policy.
- [Event Routing](event-routing.md): autonomous semantic matching and reliable event disposition.
- [Trigger Monitoring](trigger-monitoring.md): dynamic condition observation and
  durable Event generation for systems that cannot push to Relay.
- [Event Productization](event-productization.md): release requirements for
  continuation, GitHub callbacks and monitoring, lifecycle management, bilingual UI,
  operations, semantic routing, and the first email connector.
- [Monitor Bundle Platform](monitor-bundle-platform.md): public Bundle discovery,
  plugin registration, Agent-authored scoped Bundles, sandboxed capability execution,
  and migration of Time/GitHub monitoring out of Core.
- [Repository Workflow](repository-workflow.md): Relay and DSH repository ownership,
  official checkout synchronization and development checks.
- [DSH Upstream Boundary](dsh-upstream-boundary.md): mandatory immutability and
  extension rules for the official DSH source checkout.
- [Plugin System](plugin-system.md): manifests, capability interaction, lifecycle,
  monorepo boundaries, distribution composition, and regression gates.
- [Plugin Persistent Data Lifecycle](plugin-persistent-data-lifecycle.md): storage
  ownership, automatic migrations, uninstall/reinstall behavior, recovery, and
  release gates for plugins whose data survives package lifecycle operations.
- [DSH Plugin Boundaries](dsh-plugin-boundaries.md): installable DSH plugin ownership,
  workbench extension contracts, and composition acceptance matrix.
- [DSH Plugin Packaging](dsh-plugin-packaging.md): independently released package
  ownership and package-level acceptance requirements.

## Organization Rules

The specification grows with the product instead of predicting a final hierarchy.

1. Start with the fewest files and shallowest directory structure that keep each
   requirement easy to find.
2. Every specification directory must contain a `README.md` index. A parent index
   points to child documents or directories without copying their requirements.
3. Define each requirement in one place. Other documents link to that definition
   instead of maintaining a second version.
4. Split a document when it contains independently changing concerns or when its
   index no longer makes the content easy to scan.
5. Add a subdirectory only when a concern needs multiple documents. Do not create
   placeholder hierarchy for possible future work.
6. Merge or reorganize documents when the conceptual boundaries change. Update all
   affected indexes in the same change.

Codex Session import validation uses a child directory because it maintains multiple
independently executed risk protocols and a shared evidence contract. Other current
specification concerns remain as files in this indexed directory.
