# Integrations

- `codex/` is the `relay-dsh-plugin-codex` submodule and self-contained
  `@relay/dsh-plugin-codex` DSH bundle. Its independent repository owns the Codex App
  Server runtime. It owns the Codex preset, activity UI, files, and terminal.
- `claude/` is the `relay-dsh-plugin-claude` submodule and self-contained
  `@relay/dsh-plugin-claude` DSH bundle. Its independent repository owns the Claude
  Agent SDK runtime.
- `deepseek-harness/` is the provider-neutral `@relay/plugin-events` bundle. It
  installs Wait/Monitor tools for every DSH root conversation and exposes the exact
  `POST /api/relay/events` ingress route.

Connectors to external systems live here.

The three installable bundles are runtime-independent: Codex and Claude have no
Relay plugin dependencies, while Events has no backend imports.

Expected later provider-specific integrations:

- Email and customer support events.
- Signed webhook providers and payload transforms.
- Notification systems.
- Repository and CI providers.
