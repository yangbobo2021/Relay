# Relay Plugin Architecture

## Shape

Relay remains a monorepo, but every plugin boundary is also a package boundary. The
runtime has no ambient service locator: a distribution creates a `PluginHost`, loads
public plugin entrypoints, and plugins receive only the versioned capabilities they
declared in their manifests.

```text
relay-dsh-plugin-codex  --> Codex App Server + DSH Codex adapter
relay-dsh-plugin-claude --> Claude Agent SDK + DSH Claude adapter

@relay/dsh-plugin-workbench --> generic layout + view registry + keyed slots
@relay/dsh-plugin-files     --> workspace Remote + side-view contribution
@relay/dsh-plugin-terminal  --> provider registry + terminal Remote + bottom view

@relay/plugin-events --> relay.dsh.platform + relay.event-runtime + relay.dsh.events
                         attaches to every DSH root Agent
```

The two execution backends are self-contained and do not depend on Events or another
Relay package at runtime. Events is an optional provider-neutral layer that uses DSH
Agent, Session, inbox, and tool contracts; it never imports a backend.

At the DSH boundary, Codex maps the current `GenerateOptions.tools` to an App Server
`dsh` dynamic-tool namespace. Claude maps the same schemas to an in-process SDK MCP
server. Both dispatch only through the owning Agent's `ctx.tools.execute()`. This is
a generic DSH adapter responsibility, so neither backend knows which plugin supplied
a tool. Auxiliary title and compaction calls receive no contributed tools.

## Packages

| Package | Role | Public entrypoint |
| --- | --- | --- |
| `@relay/plugin-sdk` | manifests, capability registry, lifecycle | `.` |
| `@relay/event-router` | routing protocol and algorithms | `.` |
| `@relay/runtime` | Event/Wait persistence and dispatch library | `.` |
| `@relay/monitor-runtime` | Monitor and timer library | `.` |
| `@relay/plugin-event-runtime` | Event and Monitor service plugin | `.` |
| `@relay/dsh-plugin-contracts` | Type-only Workbench and terminal-provider contracts | `.` |
| `relay-dsh-plugin-codex` | Self-contained Codex DSH backend and preset | package exports |
| `relay-dsh-plugin-claude` | Self-contained Claude DSH backend and preset | package exports |
| `@relay/plugin-events` | Provider-neutral Events, Waits, Monitors, ingress, tools | package exports |
| `@relay/dsh-plugin-workbench` | Generic DSH shell and view registry | package exports |
| `@relay/dsh-plugin-files` | Workspace file explorer contribution | package exports |
| `@relay/dsh-plugin-terminal` | Provider-neutral interactive terminal contribution | package exports |

Package exports are intentionally narrow. Tests may import local modules for unit
coverage, but production code cannot reach another plugin's implementation path.

## Interaction Rules

1. A provider publishes an operation-oriented capability. It does not publish its
   runtime, client, event emitter, database, or mutable maps.
2. A consumer declares the capability and version range in its plugin manifest, then
   obtains it from its activation context.
3. Subscriptions return an idempotent release function. Plugin disposal calls every
   release function in reverse activation order. The consumer passes each release
   function to activation `defer` as soon as it is acquired.
4. Optional cross-cutting behavior is installed as its own DSH bundle. A backend
   must not detect it or change its product behavior when it is present.
5. Relay runtime plugins interact through versioned capability contracts. Independently
   installed DSH bundles interact only through public DSH extension contracts such as
   Cordis services, tools, Agent lifecycle, Session inbox, remotes, and UI slots.
6. A new interaction never adds a source import of another plugin, checks another
   plugin's package/name, or reaches into its mutable runtime objects.

## External Plugin Repositories

Codex and Claude already have independent Git histories. Relay pins them as Git
submodules under `integrations/` so this repository can assemble and test a complete
distribution without owning their source history. Each plugin must pass its own CI
against a pinned official DSH checkout before Relay advances its submodule pointer.

Moving another plugin to a separate repository follows the same sequence:

1. Split the plugin directory with its history, tests, manifest, lockfile, and CI.
2. Verify the repository in isolation against the official DSH checkout.
3. Replace the Relay directory with a pinned submodule at the same path.
4. Publish under the same package name and preserve public entrypoints.
5. Later, a distribution may replace the submodule workspace with an npm dependency;
   capability and DSH contracts must require no consumer implementation changes.
6. Run `npm test`, `npm run test:package:plugins`, `npm run test:package:dsh`, and
   `npm run test:install:dsh-official`.

No consumer implementation changes are expected. A repository move that requires
editing DSH composition indicates that the old capability contract leaked provider
details and must be corrected before the move.

## Permanent Gates

- `packages/plugin-sdk/test/plugin-host.test.mjs`: versions, ordering, substitution,
  cycles, rollback, and reverse disposal.
- Plugin-specific tests: operation surface and resource release using fake clients or
  fake capabilities.
- `scripts/test/plugin-boundaries.test.mjs`: no cross-plugin relative imports and no
  internal `@relay/*` subpaths; contract imports are type-only and backend UI ownership
  cannot regress.
- `scripts/test/dsh-independent-backends.test.mjs`: backend packages have no Relay
  dependencies or Events-specific names, while Events stays provider-neutral.
- Backend adapter tests: an arbitrary DSH tool is mapped, executed through
  `ctx.tools.execute()`, scoped to the current turn, and excluded from auxiliary calls.
- `scripts/test/plugin-packages.test.mjs`: independent manifests and narrow exports.
- `npm run test:package:plugins`: pack, clean-directory install, and public-entry
  import for every shared package and execution/Event plugin.
- `npm run test:package:dsh`: build, pack, clean-directory install, and content audit.
- Official DSH Web browser verification for the selected distribution.
