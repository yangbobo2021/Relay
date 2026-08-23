# Relay DSH Claude

`@relay/dsh-claude` installs Claude Code as a native DeepSeek Harness conversation
backend. It ships the Claude preset and activity projection.

The package depends on `@relay/dsh-core` and activates a compatible shared Core when
DSH installs this package alone. It communicates with Core only through public
package exports and versioned Relay capabilities.

```bash
dsh plugin --profile web add @relay/dsh-claude
```

Build and verification from the Relay monorepo:

```bash
npm run prepare:dsh
npm --workspace @relay/dsh-claude run typecheck
npm --workspace @relay/dsh-claude run build
npm run test:install:dsh-official
```
