# Runtime

This package implements Relay's waiting projection, Event router, and reliable DSH
inbox dispatch described by the [Runtime Specification](../../docs/spec/runtime.md).

## Public API

`RelayRuntime` accepts:

- `router.route({ event, eventRecord, sessions })` for semantic disposition;
- `inbox.deliver({ sessionId, activationId, deliveries })` for shared-harness
  admission;
- an optional Monitor registrar.

Its primary operations are `registerWaits`, `cancelWaits`, `listWaits`, `handleEvent`,
and `dispatchSession`. It has no API for creating a conversation or running an Agent.

## Implemented

- SQLite schema version 4 and idempotent normalized Event ingestion;
- autonomous `deliver`, `escalate`, and `dismiss` commits;
- several Waits per DSH Session and non-exclusive multi-Session delivery;
- stable Activation IDs and expiring dispatch leases across retries;
- atomic Wait replacement/cancellation and Monitor rearm;
- stale semantic decisions rejected by versions and routing epoch;
- inspectable Events, attempts, decisions, Deliveries, Activations, Waits, and Monitors.

The `sessions` table is a migration-era name for a Relay waiting projection keyed by
an existing DSH Session ID. `runs` remains for schema compatibility but the public
runtime does not create or consume Relay Runs.

The store uses Node's synchronous experimental `node:sqlite` API and is a validation
implementation, not a production database commitment.
