# DSH Plugin Packaging

Relay's DeepSeek Harness integration is published as independent packages:

- `relay-dsh-plugin-codex` owns the Codex App Server runtime, DSH adapter, activity UI,
  optional terminal-provider contribution, and Codex preset.
- `relay-dsh-plugin-claude` owns the Claude Agent SDK runtime, DSH adapter, activity UI,
  and Claude preset.
- `relay-dsh-plugin-events` owns Wait/Event/Delivery and Monitor persistence,
  delivery, ingress, Wait tools, and the waiting-event settings view.
- `relay-dsh-plugin-semantic-router` owns structured model routing through DSH LLM.
- `relay-dsh-plugin-monitors` owns timer tools, trusted observers, checks and triggers.
- `relay-dsh-plugin-workbench` owns the generic replacement shell and view registry.
- `relay-dsh-plugin-files` owns workspace file transport and its side view.
- `relay-dsh-plugin-terminal` owns terminal transport, provider registry, and its
  bottom view.
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

Workbench publishes its view contract from
`relay-dsh-plugin-workbench/contracts`. Files, Terminal, and future view plugins
may depend on that public type entry and the `ctx.workbench` Cordis service; they
must not import Workbench source files or implementation modules.

## Acceptance

1. Package tests reject any `@relay/*` runtime dependency in Codex or Claude.
2. Source-boundary tests reject cross-plugin relative imports and internal package
   paths.
3. Codex-only and Claude-only official DSH profiles contain no Events Host, tools,
   management Remote, or settings contribution.
4. Events-only attaches to standard DSH root conversations without backend names.
5. Backends, Events, Workbench surfaces, and every supported combination boot from clean tarballs
   in fresh official DSH profiles.
6. Removing Events leaves Codex and Claude installation and conversation behavior
   intact.
7. The official DSH checkout remains clean before and after verification.
8. A synthetic third-party DSH tool is visible and executable in both backends, while
   an unadvertised tool is rejected and auxiliary calls expose no contributed tools.
9. A synthetic side or bottom view registers without editing Workbench source.
10. Codex-only and Claude-only profiles preserve the official DSH layout.
11. Workbench, Files, and Terminal are tracked as independently buildable Git
    submodules once their repositories are created.
12. Workbench, Files, and Terminal pass a browser E2E path against official DSH:
    fresh profile install, direct Files/Terminal installs, explicit Workbench
    composition, Web boot, plugin client asset loading, panel menu visibility,
    Files side-view opening/closing, workspace file preview, Terminal
    bottom-view opening/closing, provider-unavailable terminal state, absence
    of uninstalled views, and no browser runtime or local resource errors.
13. Codex exposes a user-visible App Server state (`not-started`, `starting`,
    `connected`, `connection-failed`, `unavailable`, or `rebind-required`) and
    maps missing executable/runtime failures to actionable stable codes rather
    than raw spawn errors.
14. Blank-session Standard/Codex/Claude switching selects the matching provider
    capabilities and rejects stale asynchronous model-discovery results.
15. A Codex fork uses App Server `thread/fork` with the owned parent Thread and
    completed Turn, then persists the returned child Thread binding. Missing or
    rejected provenance fails closed without fallback `thread/start`. Persisted
    resume failures never create replacement Threads, and stale approvals are
    rejected unless DSH Session, Thread, Turn, Item, request, and binding epoch
    still match.
16. Codex launcher and status/error tests run on macOS, Windows, and Linux CI;
    official DSH remains an immutable compatibility reference.
17. Plugin Manager passes its independent package verification, packed official
    DSH installation, real client-bundle registration, and control-free Settings
    help acceptance before Relay advances its submodule pointer.
18. Every plugin that owns persistent data satisfies the
    [Plugin Persistent Data Lifecycle](plugin-persistent-data-lifecycle.md), including
    packed upgrades from every supported published schema and an uninstall-with-data
    retained followed by candidate reinstall.
