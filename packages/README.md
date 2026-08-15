# Packages

Reusable Relay runtime modules live here.

Implemented:

- [`runtime/`](runtime/README.md) for the durable session execution contract.
- [`event-router/`](event-router/README.md) for shared routing decision constraints.
- [`monitor-runtime/`](monitor-runtime/README.md) for durable local condition checks
  and bound trigger delivery.

Likely next modules, added only when their boundaries become concrete:

- `context-compressor/` for task-aware context reduction.
- `project-dispatcher/` for routing child sessions into project directories.
- `tool-registry/` for Relay-native and DSH-compatible tools.
