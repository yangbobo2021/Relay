# Relay Specification

This directory is the source of truth for Relay's required behavior. Architecture
documents may describe an implementation, and decision records may explain a
choice, but neither should redefine the requirements here.

## Index

- [Product](product.md): purpose, first users, first scenario, priorities, and MVP boundaries.
- [Runtime](runtime.md): DSH ownership, Wait registration, Event delivery, and invariants.
- [Codex In DSH Web](codex-app-server.md): native DSH Session lifecycle, Codex Thread
  binding and projection, approvals, and Relay Event continuation.
- [Event Routing](event-routing.md): autonomous semantic matching and reliable event disposition.
- [Trigger Monitoring](trigger-monitoring.md): dynamic condition observation and
  durable Event generation for systems that cannot push to Relay.
- [Repository Workflow](repository-workflow.md): Relay and DSH repository ownership,
  fork synchronization, contribution branches, and destructive-operation checks.

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

The current specification has six distinct concerns, so they remain as files in one
indexed directory. More levels are not justified yet.
