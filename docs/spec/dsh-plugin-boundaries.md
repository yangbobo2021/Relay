# DSH Plugin Boundaries

Status: Accepted

Current compatibility baselines: official DSH `0.1.5-rc.2`, tag commit
`fb2c4b9e698e30edb738bca4cf0618587db7d203`, and `0.1.6-alpha.1`, tag commit
`0a15e36e7f82b6ed45af6fa9759f29b40dcd965d`, accepted on 2026-09-15. See the
[latest recorded compatibility run](../../dsh-lab/dsh-0.1.6-alpha.1-20260915/README.md).

## Purpose

Relay's maintained DSH integrations must remain installable on an unmodified
official DSH release. Conversation backends and cross-cutting events are
separate extension concerns. A plugin may communicate with another plugin only
through a versioned Cordis service, DSH slot, Typert Remote, or a type-only
public contract.

## Packages

| Package | Kind | Responsibility |
| --- | --- | --- |
| `relay-dsh-plugin-workbench` | retired legacy plugin | Historical replacement shell and view registry. Official DSH now owns layout and right-sidebar extension surfaces. |
| `relay-dsh-plugin-files` | retired legacy plugin | Historical workspace explorer. Official DSH now owns workspace files, the file tree, and document preview. |
| `relay-dsh-plugin-terminal` | retired legacy plugin | Historical xterm surface and provider registry. Official DSH now owns terminal control and the interactive sidebar terminal. |
| `relay-dsh-plugin-codex` | installable DSH plugin | Codex conversations and App Server integration. |
| `relay-dsh-plugin-claude` | installable DSH plugin | Claude conversations only. |
| `relay-dsh-plugin-session-import` | installable DSH plugin | Neutral sidebar import entry and typed provider slot; each backend owns its import implementation. |
| `relay-dsh-plugin-manager` | installable DSH plugin | Conversation-based plugin discovery and confirmation-gated lifecycle management, plus a read-only Settings help tab. |
| `relay-dsh-plugin-events` | installable DSH plugin | Durable Wait/Event/Delivery and Monitor records, inbox admission, ingress, management, public contracts. |
| `relay-dsh-plugin-semantic-router` | installable DSH plugin | Tool-free DSH model routing; no persistence or admission. |
| `relay-dsh-plugin-monitors` | installable DSH plugin | Bounded observation and deterministic triggers; only high-level Events persistence operations. |
| `relay-dsh-plugin-monitor-time` | installable DSH plugin | Discoverable `time.deadline` Bundle Type, host-clock provider, and Session-bound timer tool. |
| `relay-dsh-plugin-monitor-process` | installable DSH plugin | Read-only process capability using opaque Session/project-bound Handles; no prebuilt Bundle Type. |
| `relay-dsh-plugin-monitor-author` | installable DSH plugin | Native DSH Skill that prefers registered Bundle Types and safely authors a custom fallback. |

Package-owned contracts contain no service implementation and are not added to a
DSH profile by themselves. Maintained plugins must not take a runtime dependency
on any retired plugin or import another plugin's implementation or internal
source.

## Retired Workspace UI Plugins

As of 2026-09-15, Workbench, Files, and Terminal are retired. They are retained
only as historical source and published artifacts for previously verified DSH
`0.1.2` installations.

Relay MUST NOT:

- adapt these three plugins to later DSH versions;
- include them in current presets, recommended installation commands, newer-DSH
  compatibility matrices, or maintained full-composition acceptance;
- add features or new runtime dependencies to them; or
- describe them as supported alternatives to the corresponding official DSH
  capabilities.

Current DSH installations MUST use the official layout/right-sidebar,
workspace-files/files/document-preview, and terminal-controller/sidebar-terminal
plugins. If Relay later needs behavior absent from official DSH, it MUST use an
official extension boundary or a new narrowly scoped adapter; it MUST NOT revive
the retired replacement layout, Files UI, or Terminal UI.

## Runtime Contracts

### Events, Semantic Router and Monitors

Events publishes `ctx.relayEvents` API v1 and `./contracts`. Semantic Router and
Monitors park their contributions until Events is available, register exactly one
provider, and release it on unload. Events alone supports exact-type routing;
Router absence does not disable ingress or delivery. Monitor proposals fail before
Wait replacement when no Monitor provider can prepare a baseline. Monitors exposes
`ctx.relayMonitorObservers` API v1 for trusted providers. No plugin imports another
plugin's runtime implementation or Relay parent source.

Time registers one localized Bundle Type and clock provider through Monitor Core's
public services. Process registers only a read-only capability and Handle tool; it
does not advertise a generic process Bundle Type. Author registers one native DSH
Skill through `ctx.skills`, lists live Bundle Types first, and uses only
Session-scoped Monitor tools for custom fallback. Unloading any extension removes
its registration without rewriting existing durable records.

### Historical Workbench, Files, and Terminal Contracts

The former `ctx.workbench` and `ctx.relayTerminalProviders` services and the
Workbench view contracts are frozen historical APIs. No maintained plugin may
newly consume them. Their previous layout, file-preview, and terminal-provider
contracts remain documented in the retired package repositories only to explain
legacy DSH `0.1.2` installations.

### Plugin Management

Plugin Manager owns one compact command, two model tools, immutable confirmation
plans, official DSH CLI execution, and a versioned discovery-provider registry.
Search providers return candidates only; installation and mutation remain owned
by the manager. It exposes no public management HTTP route and imports no Relay
parent implementation. Its `settings.plugins.tab` contribution is localized,
read-only usage help and has no Remote or mutation control.

## Composition Rules

- All maintained profiles preserve and use the official DSH layout, file, and
  terminal surfaces.
- Backends may depend on the published neutral Session Import hub. This exact
  exception does not permit Events, runtime, other backends, Workbench, or their
  implementation modules as required runtime dependencies.
- Events is optional and must not be required by any conversation plugin.
- Plugin Manager is independent of Events, conversation backends, and the
  retired workspace UI plugins.
  KeySync distribution installs it by default; standalone DSH users may install
  or remove it independently.
- Maintained plugins may not require or auto-install Workbench, Files, or
  Terminal. Any future terminal-backend integration must target an official DSH
  terminal extension boundary.
- No Relay package patches files under `upstream/deepseek-harness/`.

## Acceptance Matrix

| Scenario | Required result |
| --- | --- |
| Codex only | Codex conversation backend loads; official layout remains. |
| Claude only | Claude conversation backend loads; official layout remains. |
| Plugin Manager only | Chat exposes discovery and management tools; Settings exposes read-only help; no public management route exists. |
| Maintained full composition | Plugin Manager, Codex, Claude, Events, Router, and Monitor plugins coexist on official DSH without replacing official workspace UI. |
| Official workspace UI | The official DSH layout, Files, document preview, and Terminal load without a retired Relay workspace UI plugin. |
| Retired package exclusion | Current presets and newer-DSH compatibility jobs do not install Workbench, Files, or Terminal. Dedicated historical `0.1.2` checks may remain. |

## Recurrence Guards

Automated tests must enforce all of the following:

1. Production imports cannot cross plugin implementation directories.
2. Maintained source and bundle patches contain no dependency on Workbench,
   Files, Terminal, or their public contracts.
3. Codex source and bundle patch contain no replacement workbench layout, Files
   Remote, or Terminal UI ownership.
4. Every maintained package is independently packable and exports only public
   built files.
5. DSH profile dumps and boot probes pass for the acceptance matrix against a
   recorded clean official DSH commit.
6. The official DSH checkout is clean before and after verification.
7. Current release and newer-DSH compatibility matrices reject accidental
   installation of the three retired packages.
8. Historical tests may remain, but failures against post-`0.1.2` DSH releases
   do not create an adaptation requirement.
9. Plugin Manager package acceptance executes its packed browser bundle and
   verifies one localized, control-free Marketplace help tab alongside its two
   Host rows.
