# Event Router

This package owns provider-independent semantic routing policy and final decision
constraints.

## Files

- [`semantic.mjs`](semantic.mjs) builds compact candidate payloads, applies the
  single-pass email routing prompt, retries invalid model output once by default,
  and returns decision telemetry.
- [`decision.mjs`](decision.mjs) validates a final decision against the candidate
  snapshot.
- [`decision.schema.json`](decision.schema.json) constrains model output before the
  validator applies candidate-dependent rules.
- [`index.mjs`](index.mjs) exports the public package boundary.

Model execution remains an injected adapter. The first adapter is the
[`integrations/codex`](../../integrations/codex/README.md) CLI integration.

The validator enforces:

- known session and wait identifiers;
- active waits as the only waits a new delivery may claim;
- one delivery per session;
- no multi-session delivery involving an exclusive wait; and
- consistent `deliver`, `escalate`, `dismiss`, and optional experiment-only
  `deduplicate` shapes.
