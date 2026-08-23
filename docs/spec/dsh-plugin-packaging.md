# DSH Plugin Packaging

Relay's DeepSeek Harness integration is published as three installable packages:

- `@relay/dsh-core` owns Relay Events, Waits, workspace files, and the shared
  workbench shell.
- `@relay/dsh-codex` owns the Codex App Server adapter, Codex activity UI, and
  terminal contribution.
- `@relay/dsh-claude` owns the Claude Agent SDK adapter and Claude activity UI.

Codex and Claude depend on Core through its public package exports and Relay
capabilities. They must not import another plugin's source files. Each backend
package activates a compatible Core when DSH installs only that backend; when
both backends are present, they share one Core instance. Core is reference
counted so unloading one backend cannot dispose services still used by the
other. An incompatible Core version or failed activation must leave no partial
backend or Core registration.

Each package ships its own DSH bundle patch, browser entry, Host entry, Typert
contract, and any agent preset it contributes. A package tarball must contain
only runtime artifacts and package-owned presets. No install path may copy
files into the official DSH checkout or require Relay's monorepo layout.

## Acceptance

1. Package-boundary tests reject relative imports outside a package and
   undeclared `@relay/*` production imports.
2. Lifecycle tests prove Core reuse, reference-counted release, version checks,
   and activation rollback.
3. Clean-tarball tests import every public entry and verify backend packages
   install Core transitively.
4. Fresh official DSH profiles boot with Codex only, Claude only, and both;
   each advertised preset is discoverable and both backends coexist with one
   Core.
5. The official DSH checkout remains clean before and after verification.
