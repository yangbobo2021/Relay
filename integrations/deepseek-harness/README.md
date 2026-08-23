# Relay DSH Plugin

`relay-dsh-plugin` installs Relay into an unmodified DeepSeek Harness profile. It
contains the Codex and Claude conversation adapters, Relay Wait/Monitor management,
the workspace file viewer, and a Codex App Server-backed terminal.

The package is a distribution assembled by the Relay Plugin Host. Codex, Claude,
Event Runtime, and DSH composition communicate only through versioned capabilities;
the DSH loader imports their public package entrypoints. See
[Plugin Architecture](../../docs/design/plugin-architecture.md).

## Boundary

- DSH owns Sessions, conversation history, Agent lifecycle, filesystem access,
  Cordis composition, and client slot contracts.
- Relay owns external Events, Waits, Monitors, backend bindings, and the workbench
  views it contributes.
- The plugin does not import source files from a DSH checkout at runtime. Its npm
  tarball contains built Host/Client/Typert artifacts, the Cordis patch, and package
  metadata only.
- The plugin currently replaces `ui-layout` because DSH has no public side-panel or
  bottom-panel frame slots. File access still goes through DSH's `fs` service, while
  terminal processes go through Codex App Server `command/exec`.

## Build

With the plugin's development dependencies installed normally, run:

```bash
npm run typecheck
npm run build
npm pack
```

From the Relay root, `npm run test:package:dsh` performs those checks, installs the
tarball into a clean temporary project, and loads every public entry against peers
from the exact official DSH checkout.

When developing inside Relay, npm workspaces resolve the Relay packages explicitly.
The repository helper links DSH host and client development peers from the exact
official checkout, builds the plugin, installs the profile, and starts the Web UI:

```bash
npm run start:web -- --port 3092
```

For a packaged DSH installation, install the generated `.tgz` with the DSH plugin
command for the target profile. The package's `cordis.patch.yml` mounts the Relay
Host and replaces only the current Web workbench frame.

## Compatibility

- Browser installation and file/terminal workflows were verified against the
  public DSH `0.1.0-rc.8` package.
- The integration API was reviewed against official source commit
  `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` (`0.1.1-rc.2`).
- Relay develops against an immutable checkout of the official repository; no Fork
  source is required.

Keep compatibility fixes in this package. Only generic extension hooks that benefit
all DSH plugins should be proposed upstream.
