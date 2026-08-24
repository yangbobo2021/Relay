# DSH Plugin Boundaries

Status: Accepted

## Purpose

Relay's DSH integrations must remain installable on an unmodified official DSH
release. Conversation backends, cross-cutting events, shell layout, and
workbench surfaces are separate extension concerns. A plugin may communicate
with another plugin only through a versioned Cordis service, DSH slot, Typert
Remote, or a type-only public contract.

## Packages

| Package | Kind | Responsibility |
| --- | --- | --- |
| `@relay/dsh-plugin-contracts` | library | Legacy type-only contracts for Relay DSH plugins that have not moved to package-owned contracts. |
| `relay-dsh-plugin-workbench` | installable DSH plugin | Generic shell layout, panel state, view registry, extension slots, and the public `./contracts` entry for view plugins. |
| `relay-dsh-plugin-files` | installable DSH plugin | Workspace file Remote, explorer UI, and one side-view contribution. |
| `relay-dsh-plugin-terminal` | installable DSH plugin | Terminal provider registry, terminal Remote, xterm UI, and one bottom-view contribution. |
| `relay-dsh-plugin-codex` | installable DSH plugin | Codex conversations and an optional Codex terminal-provider contribution. |
| `relay-dsh-plugin-claude` | installable DSH plugin | Claude conversations only. |
| `@relay/plugin-events` | installable DSH plugin | Optional event injection across every compatible conversation backend. |

Package-owned contracts contain no service implementation and are not added to a
DSH profile by themselves. Workbench view plugins use
`relay-dsh-plugin-workbench/contracts` as a build-time type dependency. They
must not import another plugin's implementation or internal source.

## Runtime Contracts

### Workbench

The workbench publishes `ctx.workbench` through Cordis. A feature registers a
versioned view descriptor and contributes its renderer through the matching DSH
keyed slot. The descriptor selects `side` or `bottom`, provides a stable id and
label, and may provide an icon renderer. The workbench owns active-view state,
panel geometry, tabs, menus, and view selection.

The workbench has no built-in Files, Terminal, Codex, or Claude view. Removing a
feature registration removes its view and selects the next registered view. A
future right-side or bottom view must be addable without editing workbench
source.

### Terminal Providers

The terminal plugin publishes `ctx.relayTerminalProviders` through Cordis. A
conversation backend may park an optional `ctx.inject()` contribution against
that service. The terminal plugin owns browser transport and presentation; the
backend contribution owns only its PTY transport implementation.

Codex remains fully usable when the terminal plugin is absent. The terminal
plugin remains loadable with no provider and presents an unavailable state
instead of failing DSH startup.

### Files

The files plugin resolves the active DSH Agent and uses DSH filesystem services.
It has no Codex or Claude runtime dependency. Workspace containment and bounded
UTF-8 previews remain Host-enforced.

## Composition Rules

- Codex-only and Claude-only profiles preserve the official DSH layout.
- Workbench is an explicit profile layer. Files and Terminal require it as a
  peer and are installed with it by Relay's distribution tooling.
- Events is optional and must not be required by any conversation or workbench
  plugin.
- Codex may contribute a terminal provider, but may not import Terminal or
  Workbench implementation code.
- Files and Terminal may import only `relay-dsh-plugin-workbench/contracts`
  from Workbench and must not import Workbench implementation code.
- No Relay package patches files under `upstream/deepseek-harness/`.

## Acceptance Matrix

| Scenario | Required result |
| --- | --- |
| Codex only | Codex conversation backend loads; official layout remains. |
| Claude only | Claude conversation backend loads; official layout remains. |
| Workbench only | Generic layout loads with no Files/Terminal identifiers or phantom views. |
| Workbench + Files | Files appears as a side view and its Remote is mounted. |
| Workbench + Terminal | Terminal appears as a bottom view; no provider is a contained empty state. |
| Workbench + Terminal + Codex | Codex provider registers and interactive terminal transport is available. |
| Full composition | Codex, Claude, Events, Files, and Terminal coexist on official DSH. |
| Synthetic future view | A fixture registers another side/bottom view without changing Workbench. |
| Workbench UI E2E | Clean official DSH profile installs tarballs through direct Files/Terminal installs and explicit Workbench composition, opens Web in a browser, uses the panel menu, opens/closes Files and Terminal views, previews a workspace file, confirms uninstalled views are absent, and reports no browser runtime or resource errors. |

## Recurrence Guards

Automated tests must enforce all of the following:

1. Production imports cannot cross plugin implementation directories.
2. Imports from `relay-dsh-plugin-workbench/contracts` are type-only in Files
   and Terminal client source.
3. Codex source and bundle patch contain no workbench layout, Files Remote, or
   Terminal Remote ownership.
4. Workbench source contains no feature ids (`files`, `terminal`, `codex`, or
   `claude`) in view defaults or registration logic.
5. Every package is independently packable and exports only public built files.
6. DSH profile dumps and boot probes pass for the acceptance matrix against a
   recorded clean official DSH commit.
7. The official DSH checkout is clean before and after verification.
8. Browser E2E covers user-visible Workbench, Files, and Terminal panel paths,
   not only package installation and Host boot.
9. View plugins that activate Workbench for single-plugin installs must use
   plugin-specific loader ids, and Workbench client initialization must remain
   idempotent so multiple view plugins compose together.
