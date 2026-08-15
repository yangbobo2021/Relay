# Relay Worker CLI

This local vertical demo seeds sanitized Wait projections, ingests one email Event,
routes it with the production single-pass policy, injects selected Deliveries through
a fixture inbox, and prints the durable records. It does not run or create an Agent.

Run deterministic routing:

```bash
npm run demo:worker -- --router expected --reset
```

Use `--router semantic` for the configured Codex CLI model, `--json` for full output,
`--fixture ID` to select a case, and `--db PATH` to retain local state. Fixtures that
require pre-existing duplicate state remain regression tests rather than demo seeds.
