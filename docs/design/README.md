# Relay Design

These documents describe the first implementation and validation approach. They
implement, but do not redefine, the [Relay Specification](../spec/README.md).

- [Runtime Design](runtime.md) defines storage, transactions, leases, and component
  interfaces for the first local runtime.
- [Routing Validation](routing-validation.md) defines the semantic router prototype,
  fixture strategy, metrics, and release gates.
- [Monitor Runtime](monitor-runtime.md) defines dynamic Monitor bundles, scheduling,
  state comparison, sandboxing, and bound trigger delivery.
- [Codex In DSH Web](codex-app-server.md) defines the native DSH extension points,
  App Server client, Thread projection, and Relay delivery adapter.
- [Conversation Presentation](conversation-presentation.md) defines the global
  simple/default conversation and reversible advanced diagnostic surfaces.

This directory follows the specification's
[organization rules](../spec/README.md#organization-rules). The five current concerns
are independent but small, so no deeper hierarchy is needed.
