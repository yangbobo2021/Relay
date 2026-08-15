# Integrations

- `deepseek-harness/` is an installable DSH bundle. It injects Relay Events through
  DSH's shared Agent lookup and installs Agent tools for Wait registration,
  cancellation, and durable one-shot timers.

Connectors to external systems live here.

Implemented:

- [`codex/`](codex/README.md) provides the Codex CLI semantic-routing adapter.

Expected later integrations:

- Email and customer support events.
- Webhook providers.
- Notification systems.
- DeepSeek Harness adapters.
- Codex-compatible project execution.
- Repository and CI providers.
