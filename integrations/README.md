# Integrations

- `deepseek-harness/` is an installable DSH bundle. It injects Relay Events through
  DSH's shared Agent lookup, installs Wait/timer tools, and contributes Codex App
  Server as a native DSH Web conversation preset. Its exact
  `POST /api/relay/events` route is the production ingress for local webhooks and
  authenticated non-loopback connectors.

Connectors to external systems live here.

Implemented:

- [`codex/`](codex/README.md) provides the Codex CLI semantic-routing adapter and the
  App Server Thread runtime used by the DSH integration.

Expected later provider-specific integrations:

- Email and customer support events.
- Signed webhook providers and payload transforms.
- Notification systems.
- Repository and CI providers.
