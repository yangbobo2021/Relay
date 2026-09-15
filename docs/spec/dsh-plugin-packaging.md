# DSH Plugin Packaging

Relay's DeepSeek Harness integration is published as independent packages:

- `relay-dsh-plugin-codex` owns the Codex App Server runtime, DSH adapter,
  activity UI, and Codex preset.
- `relay-dsh-plugin-claude` owns the Claude Agent SDK runtime, DSH adapter, activity UI,
  and Claude preset.
- `relay-dsh-plugin-events` owns Wait/Event/Delivery and Monitor persistence,
  delivery, ingress, Wait tools, and the waiting-event settings view.
- `relay-dsh-plugin-semantic-router` owns structured model routing through DSH LLM.
- `relay-dsh-plugin-monitors` owns timer tools, trusted observers, checks and triggers.
- `relay-dsh-plugin-workbench`, `relay-dsh-plugin-files`, and
  `relay-dsh-plugin-terminal` are retired legacy packages. They retain their
  historical source and releases but receive no compatibility adaptations for
  DSH versions after the verified `0.1.2` line.
- `relay-dsh-plugin-manager` owns plugin discovery, confirmation-gated profile
  lifecycle operations, its search-provider registry, and read-only Settings help.

Codex, Claude, and Plugin Manager have no runtime dependency on another Relay
package. Installing either backend adds only its conversation mode and product
behavior; installing Plugin Manager adds only its command/tools, Host services,
and read-only help tab. They do not import, detect, or conditionally expose
Events features.

Events is a provider-neutral DSH bundle. It attaches its tools to every root Agent
through DSH's Agent lifecycle and delivers through DSH's shared Session lookup and
inbox. It therefore applies equally to standard DSH, Codex, Claude, and future
conversation backends without importing any backend implementation.

Codex and Claude implement a provider-neutral bridge for the standard tool schemas
in each DSH model request. Codex uses an App Server `dsh` dynamic-tool namespace;
Claude uses an in-process SDK MCP server. Tool calls return to the owning Agent's
`ctx.tools.execute()` and are limited to the schemas assembled for that turn. This
lets Events and future plugins add capabilities without either backend importing or
detecting them.

Each package ships its own DSH bundle patch and Host entry. Browser entries, Typert
contracts and presets are included only where needed; Router and Monitors are
Host-only plugins. A package tarball contains runtime artifacts,
not Relay or DSH source trees. No install path writes into the official DSH checkout
or assumes the Relay monorepo layout.

No maintained package may depend on Workbench, Files, Terminal,
`relay-dsh-plugin-workbench/contracts`, or `ctx.workbench`. Current packages use
the official DSH layout, workspace-file, document-preview, and terminal surfaces.
The retired packages are excluded from current presets, recommended installation
commands, new releases, and newer-DSH compatibility claims. Dedicated historical
`0.1.2` packaging and regression checks may remain.

## Acceptance

1. Package tests reject any `@relay/*` runtime dependency in Codex or Claude.
2. Source-boundary tests reject cross-plugin relative imports and internal package
   paths.
3. Codex-only and Claude-only official DSH profiles contain no Events Host, tools,
   management Remote, or settings contribution.
4. Events-only attaches to standard DSH root conversations without backend names.
5. Backends, Events, and every maintained supported combination boot from clean
   tarballs in fresh official DSH profiles.
6. Removing Events leaves Codex and Claude installation and conversation behavior
   intact.
7. The official DSH checkout remains clean before and after verification.
8. A synthetic third-party DSH tool is visible and executable in both backends, while
   an unadvertised tool is rejected and auxiliary calls expose no contributed tools.
9. Codex-only and Claude-only profiles preserve the official DSH layout.
10. Current presets, package guides, and newer-DSH compatibility jobs do not
    install or recommend Workbench, Files, or Terminal.
11. The retired submodules remain available as historical source; they are not
    required to pass compatibility tests against newer DSH releases.
12. Codex exposes a user-visible App Server state (`not-started`, `starting`,
    `connected`, `connection-failed`, `unavailable`, or `rebind-required`) and
    maps missing executable/runtime failures to actionable stable codes rather
    than raw spawn errors.
13. Blank-session Standard/Codex/Claude switching selects the matching provider
    capabilities and rejects stale asynchronous model-discovery results.
14. A Codex fork uses App Server `thread/fork` with the owned parent Thread and
    completed Turn, then persists the returned child Thread binding. Missing or
    rejected provenance fails closed without fallback `thread/start`. Persisted
    resume failures never create replacement Threads, and stale approvals are
    rejected unless DSH Session, Thread, Turn, Item, request, and binding epoch
    still match.
15. Codex launcher and status/error tests run on macOS, Windows, and Linux CI;
    official DSH remains an immutable compatibility reference.
16. Plugin Manager passes its independent package verification, packed official
    DSH installation, real client-bundle registration, and control-free Settings
    help acceptance before Relay advances its submodule pointer.
18. Every plugin that owns persistent data satisfies the
    [Plugin Persistent Data Lifecycle](plugin-persistent-data-lifecycle.md), including
    packed upgrades from every supported published schema and an uninstall-with-data
    retained followed by candidate reinstall.
