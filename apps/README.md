# Apps

User-facing Relay applications live here.

Implemented:

- [`relay-worker/`](relay-worker/README.md) for the fixture-driven local vertical
  worker CLI.

Possible later applications, added when their product boundary is concrete:

- `relay-cli/` for broader local developer workflows.
- a Wait/Monitor management surface linked to DSH conversations.
- `relay-api/` for external event ingestion and product integration.

Codex conversation UI is deliberately not an application here. It is contributed to
the native DSH Web surface by `integrations/deepseek-harness/`.
