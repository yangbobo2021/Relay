# Integrations

- `deepseek-harness/` is the installable `@relay/dsh-core` bundle. It injects Relay
  Events through DSH's shared Agent lookup and installs Wait/timer tools. Its exact
  `POST /api/relay/events` route is the production ingress for local webhooks and
  authenticated non-loopback connectors.
- `dsh-codex/` and `dsh-claude/` are independently installable backend bundles;
  each ships its own preset and depends only on Core's public package contract.

Connectors to external systems live here.

Implemented:

- [`codex/`](codex/README.md) provides the Codex CLI semantic-routing adapter and the
  App Server Thread runtime used by the DSH integration.

Expected later provider-specific integrations:

- Email and customer support events.
- Signed webhook providers and payload transforms.
- Notification systems.
- Repository and CI providers.
