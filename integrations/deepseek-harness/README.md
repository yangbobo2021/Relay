# Relay DSH Core

`@relay/dsh-core` installs Relay Events, Wait/Monitor management, and the shared
workspace file workbench into an unmodified DeepSeek Harness profile. It contains
no Codex or Claude execution implementation.

Codex and Claude are separate `@relay/dsh-codex` and `@relay/dsh-claude` DSH
plugins. Each depends on Core's public runtime/client lifecycle and can activate a
compatible Core when installed alone. See
[Plugin Architecture](../../docs/design/plugin-architecture.md).

## Boundary

- DSH owns Sessions, conversation history, Agent lifecycle, filesystem access,
  Cordis composition, and client slot contracts.
- Relay Core owns external Events, Waits, Monitors, and shared workbench views.
- Backend bindings and backend-specific views stay in their own DSH packages.
- The plugin does not import source files from a DSH checkout at runtime. Its npm
  tarballs contain built Host/Client/Typert artifacts, Cordis patches, package-owned
  presets, and metadata only.
- The plugin currently replaces `ui-layout` because DSH has no public side-panel or
  bottom-panel frame slots. File access still goes through DSH's `fs` service, while
  terminal processes in `@relay/dsh-codex` go through Codex App Server `command/exec`.

## Build

With the plugin's development dependencies installed normally, run:

```bash
npm run typecheck
npm run build
npm pack
```

From the Relay root, `npm run test:package:dsh` performs those checks for all three
DSH packages. `npm run test:install:dsh-official` validates Codex-only,
Claude-only, and coinstalled profiles against the exact official DSH checkout.

When developing inside Relay, npm workspaces resolve the Relay packages explicitly.
The repository helper links DSH host and client development peers from the exact
official checkout, builds the plugin, installs the profile, and starts the Web UI:

```bash
npm run start:web -- --port 3092
```

For a packaged DSH installation, install any generated `.tgz` with the DSH plugin
command for the target profile. Installing Codex or Claude brings Core as a normal
package dependency and activates one shared Core instance.

## Compatibility

- Browser installation and file/terminal workflows were verified against the
  public DSH `0.1.0-rc.8` package.
- The integration API was reviewed against official source commit
  `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` (`0.1.1-rc.2`).
- Relay develops against an immutable checkout of the official repository; no Fork
  source is required.

Keep compatibility fixes in this package. Only generic extension hooks that benefit
all DSH plugins should be proposed upstream.
