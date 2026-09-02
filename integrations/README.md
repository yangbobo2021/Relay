# Integrations

- `codex/` is the `relay-dsh-plugin-codex` submodule and self-contained
  `relay-dsh-plugin-codex` DSH bundle. Its independent repository owns the Codex App
  Server runtime, Codex preset, activity UI, and optional terminal provider.
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
- `dsh-workbench/` is the generic shell, panel registry, keyed view host, and
  public `relay-dsh-plugin-workbench/contracts` provider.
- `dsh-files/` contributes the workspace explorer side view through Workbench's
  public contract.
- `dsh-terminal/` contributes the provider-neutral interactive bottom view
  through Workbench's public contract.
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
