# Relay Plugin Architecture

## Shape

Relay remains a monorepo, but every plugin boundary is also a package boundary. The
runtime has no ambient service locator: a distribution creates a `PluginHost`, loads
public plugin entrypoints, and plugins receive only the versioned capabilities they
declared in their manifests.

```text
@relay/dsh-core
  relay.dsh.platform
  provides relay.delivery.v1, relay.logging.v1, relay.dsh.workspace.v1
          |
          +--> relay.event-runtime
          |      provides relay.events.v1, relay.monitors.v1
          |
@relay/dsh-codex --> relay.execution.codex + relay.dsh.codex
@relay/dsh-claude --> relay.execution.claude + relay.dsh.claude
```

Each DSH backend consumes Core through public package exports and versioned
capabilities. Core is reference-counted at the DSH root so coinstalled backends do
not duplicate shared Host or client services.

## Packages

| Package | Role | Public entrypoint |
| --- | --- | --- |
| `@relay/plugin-sdk` | manifests, capability registry, lifecycle | `.` |
| `@relay/event-router` | routing protocol and algorithms | `.` |
| `@relay/runtime` | Event/Wait persistence and dispatch library | `.` |
| `@relay/monitor-runtime` | Monitor and timer library | `.` |
| `@relay/plugin-event-runtime` | Event and Monitor service plugin | `.` |
| `@relay/plugin-codex` | Codex App Server execution plugin | `.` |
| `@relay/plugin-claude` | Claude SDK/CLI execution plugin | `.` |
| `@relay/dsh-core` | DSH Events, Waits, workspace files, shared workbench | package exports |
| `@relay/dsh-codex` | Codex DSH adapter, activity UI, terminal, preset | package exports |
| `@relay/dsh-claude` | Claude DSH adapter, activity UI, preset | package exports |

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
4. Optional behavior is selected by presence of a capability, not by importing and
   type-checking a concrete provider.
5. A new cross-plugin interaction changes a versioned capability contract. It never
   adds a source import.

## Moving A Plugin To Another Repository

1. Move the plugin package directory with its tests and package manifest.
2. Publish it under the same package name and preserve its public entrypoint.
3. Replace the monorepo workspace dependency with the published version.
4. Change only the distribution dependency and lockfile when the capability contract
   is unchanged.
5. Run `npm test`, `npm run test:package:plugins`, `npm run test:package:dsh`, and
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
  internal `@relay/*` subpaths.
- `scripts/test/plugin-packages.test.mjs`: independent manifests and narrow exports.
- `npm run test:package:plugins`: pack, clean-directory install, and public-entry
  import for every shared package and execution/Event plugin.
- `npm run test:package:dsh`: build, pack, clean-directory install, and content audit.
- Official DSH Web browser verification for the selected distribution.
