# Relay Codex Plugin

`@relay/plugin-codex` adds a Codex conversation mode to DeepSeek Harness. One DSH
Session owns one Codex App Server Thread, including model and reasoning selection,
approvals, questions, images, tool activity, interruption, context continuation,
workspace files, and terminal surfaces.

The package has no dependency on Relay Events or any other Relay plugin. Installing
it does not add Wait, Monitor, callback, or event-management behavior.

Tools contributed by separately installed DSH plugins are mapped generically into
the Codex App Server `dsh` namespace and execute through the owning Agent's DSH tool
runtime. This plugin does not import or detect their providers.

```bash
dsh plugin --profile web add @relay/plugin-codex
```

The Codex CLI must be available and authenticated. Build and verify from Relay:

```bash
npm run prepare:dsh
npm --workspace @relay/plugin-codex run typecheck
npm --workspace @relay/plugin-codex run build
npm run test:install:dsh-official
```
