# Integrations

- `codex/` is the `relay-dsh-plugin-codex` submodule and self-contained
  `relay-dsh-plugin-codex` DSH bundle. Its independent repository owns the Codex App
  Server runtime, Codex preset, and activity UI.
- `claude/` is the `relay-dsh-plugin-claude` submodule and self-contained
  `relay-dsh-plugin-claude` DSH bundle. Its independent repository owns the Claude
  Agent SDK runtime.
- `events/` is the independent `relay-dsh-plugin-events` repository. It owns
  Wait/Event/Delivery persistence, root-Agent Wait tools, the management UI and
  `POST /api/relay/events`.
- `semantic-router/` contributes semantic decisions through the versioned Events
  Router contract and the existing DSH LLM service.
- `monitors/` contributes the timer tool, trusted observer registry and bounded
  leased checks through Events' high-level persistence contract.
- `github/` contributes signed GitHub webhook ingestion, pull-request observation,
  and the authenticated root-Agent pull-request waiting workflow through the public
  Events and Monitors capabilities.
- `email/` contributes a provider-compatible Gmail push/history cursor, bounded MIME
  normalization, deterministic thread binding, and uncorrelated semantic routing.
- `dsh-workbench/`, `dsh-files/`, and `dsh-terminal/` are retired historical
  DSH `0.1.2` plugins. They receive no further DSH compatibility adaptations;
  current installations use the corresponding official DSH surfaces.
- `dsh-plugin-manager/` is the independently released
  `relay-dsh-plugin-manager` bundle for conversation-based plugin discovery and
  lifecycle management. Its Settings contribution is read-only help.

Connectors to external systems live here.

The installable bundles are implementation-independent: Codex, Claude, and Plugin
Manager have no Relay runtime dependencies, Events has no backend imports, and
workbench features communicate through Cordis services, Typert Remotes, and DSH
slots.

Expected later provider-specific integrations:

- Email and customer support events.
- Signed webhook providers and payload transforms.
- Notification systems.
- Repository and CI providers.
