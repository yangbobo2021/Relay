# DSH Plugin Packaging

Relay's DeepSeek Harness integration is published as independent packages:

- `relay-dsh-plugin-codex` owns the Codex App Server runtime, DSH adapter, activity UI,
  optional terminal-provider contribution, and Codex preset.
- `relay-dsh-plugin-claude` owns the Claude Agent SDK runtime, DSH adapter, activity UI,
  and Claude preset.
- `@relay/plugin-events` owns external Events, Waits, Monitors, delivery, ingress,
  agent tools, and the waiting-event settings view.
- `@relay/dsh-plugin-workbench` owns the generic replacement shell and view registry.
- `@relay/dsh-plugin-files` owns workspace file transport and its side view.
- `@relay/dsh-plugin-terminal` owns terminal transport, provider registry, and its
  bottom view.

Codex and Claude have no runtime dependency on another Relay package. Installing
either backend adds only its conversation mode and product behavior. They do not
import, detect, or conditionally expose Events features.

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

Each package ships its own DSH bundle patch, browser entry, Host entry, Typert
contract, and package-owned presets. A package tarball contains runtime artifacts,
not Relay or DSH source trees. No install path writes into the official DSH checkout
or assumes the Relay monorepo layout.

Workbench publishes its view contract from
`@relay/dsh-plugin-workbench/contracts`. Files, Terminal, and future view plugins
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
