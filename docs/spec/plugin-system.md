# Plugin System Specification

## Purpose

Relay is developed as a monorepo whose plugin boundaries are also valid package and
future repository boundaries. Moving a plugin to another repository MUST require
package publication and distribution-manifest changes, not implementation rewrites.

## Interaction Rule

A plugin MAY import its own implementation and shared protocol or library packages.
It MUST NOT import another plugin's implementation, internal export, source path, or
mutable singleton. The distribution loader MAY import each plugin's declared public
entrypoint solely to activate it.

Plugins interact through versioned capabilities obtained from the Plugin Host. An
in-process method call on an injected capability is a plugin interaction; a direct
import of the provider implementation is not.

## Manifest

Every plugin manifest MUST declare:

- a globally unique, stable `id`;
- a semantic `version`;
- every provided capability and its semantic version;
- every required capability and accepted version range;
- optional capabilities and accepted ranges;
- permissions when the plugin crosses a privileged boundary.

The package `exports` map MUST expose only supported public entrypoints. Source and
internal paths MUST remain inaccessible through package exports.

## Activation And Lifecycle

The Plugin Host MUST:

1. validate every manifest before running plugin code;
2. reject duplicate plugin IDs and capability providers;
3. verify required capability presence and version compatibility;
4. order activation by required and available optional capabilities;
5. expose only declared capabilities to consumers;
6. roll back activated plugins in reverse order after activation failure;
7. dispose all plugins in reverse activation order;
8. remove disposed capabilities from the registry.

Activation is transactional. A plugin MUST call the activation context's `defer`
immediately after acquiring each listener, process, database, Remote scope, or other
resource that can outlive the current statement. Deferred cleanup runs in reverse
registration order if activation fails. On normal unload, the disposer returned by
`activate` runs first, followed by deferred cleanup in reverse order. Cleanup errors
MUST NOT hide the original activation error.

A plugin MUST be replaceable by another provider that satisfies the same capability
contract. Consumers MUST work with a Fake Provider in isolation tests.

## Monorepo Boundaries

The initial plugin domains are:

- `relay.event-runtime`: Event, Wait, Monitor, Delivery, routing, and persistence;
- `relay.execution.codex`: Codex App Server execution sessions;
- `relay.execution.claude`: Claude SDK/CLI execution sessions;
- `relay.dsh`: DSH Session delivery, LLM presentation, management, and workbench;
- `relay.distribution.dsh-web`: the selected plugin set and configuration.

Shared packages such as `@relay/plugin-sdk`, `@relay/runtime`, and
`@relay/event-router` are libraries, not ambient service locators. A plugin may use a
shared library only through its package public export.

## Distribution

A distribution MUST select plugins through a declarative manifest. Selection MUST
support optional plugins without source edits to other plugins. Distribution code
MUST NOT instantiate provider implementation classes or pass provider internals into
consumers.

## Acceptance And Recurrence Prevention

Each plugin-system change MUST establish its acceptance test before implementation.
The permanent gates are:

- Plugin Host lifecycle, substitution, version, missing-dependency, and cycle tests;
- static rejection of cross-plugin relative imports and internal package imports;
- public-export and plugin/package manifest consistency checks;
- tests that activate consumers against Fake Providers;
- packed-artifact installation in a clean directory;
- unload/reload tests proving capabilities, Cordis Remotes, listeners, and in-flight
  database work are released safely;
- official DSH browser tests for the selected distribution.

No documentation exception may waive a failing boundary gate. A new interaction
requires a new versioned capability or a shared protocol change.
