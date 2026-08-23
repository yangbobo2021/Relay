# Relay DSH Codex

`@relay/dsh-codex` installs Codex App Server as a native DeepSeek Harness
conversation backend. It ships the Codex preset, activity projection, and terminal
workbench contribution.

The package depends on `@relay/dsh-core` and activates a compatible shared Core when
DSH installs this package alone. It communicates with Core only through public
package exports and versioned Relay capabilities.

```bash
dsh plugin --profile web add @relay/dsh-codex
```

Build and verification from the Relay monorepo:

```bash
npm run prepare:dsh
npm --workspace @relay/dsh-codex run typecheck
npm --workspace @relay/dsh-codex run build
npm run test:install:dsh-official
```
