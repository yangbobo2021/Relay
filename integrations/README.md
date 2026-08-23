# Integrations

- `codex/` is the `relay-dsh-plugin-codex` submodule and self-contained
  `@relay/dsh-plugin-codex` DSH bundle. Its independent repository owns the Codex App
  Server runtime, Codex preset, activity UI, and optional terminal provider.
- `claude/` is the `relay-dsh-plugin-claude` submodule and self-contained
  `@relay/dsh-plugin-claude` DSH bundle. Its independent repository owns the Claude
  Agent SDK runtime.
- `deepseek-harness/` is the provider-neutral `@relay/plugin-events` bundle. It
  installs Wait/Monitor tools for every DSH root conversation and exposes the exact
  `POST /api/relay/events` ingress route.
- `dsh-workbench/` is the generic shell, panel registry, and keyed view host.
- `dsh-files/` contributes the workspace explorer side view.
- `dsh-terminal/` contributes the provider-neutral interactive bottom view.

Connectors to external systems live here.

The installable bundles are implementation-independent: Codex and Claude have no
Relay plugin dependencies, Events has no backend imports, and workbench features
communicate through Cordis services, Typert Remotes, and DSH slots.

Expected later provider-specific integrations:

- Email and customer support events.
- Signed webhook providers and payload transforms.
- Notification systems.
- Repository and CI providers.
