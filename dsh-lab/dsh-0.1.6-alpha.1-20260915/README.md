# DSH 0.1.6-alpha.1 Compatibility Record

Date: 2026-09-15

## Official reference

- Release: `@deepseek-ai/dsh@0.1.6-alpha.1`
- Git tag: `dsh-v0.1.6-alpha.1`
- Tag commit: `0a15e36e7f82b6ed45af6fa9759f29b40dcd965d`
- npm SHA-1: `c8cb089890bd22b0dd2054d4a7c102e9a5c49e6d`
- npm integrity: `sha512-i6rIfIF2FEAINJY9TnihdFFuE1CfD/Htjcb7sqpYWujLrfkxwsFp8shyvAUz+Aj2yU28N0zd/HSxMaOnbRhoBw==`
- Release page: <https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.6-alpha.1>

The official checkout remained an immutable reference throughout the run. Relay
plugins were built and packed from their own repositories; disposable DSH
profiles were created outside both repositories.

## Scope and result

The same 10 maintained plugins remain compatible with both `0.1.5-rc.2` and
`0.1.6-alpha.1`:

| Package | Source version | Result on `0.1.6-alpha.1` |
| --- | ---: | --- |
| `relay-dsh-plugin-manager` | `0.3.1-rc.2` | pass |
| `relay-dsh-plugin-session-import` | `0.2.3-rc.2` | pass |
| `relay-dsh-plugin-codex` | `0.2.3-rc.2` | pass |
| `relay-dsh-plugin-claude` | `0.2.3-rc.2` | pass |
| `relay-dsh-plugin-events` | `0.2.4-rc.1` | pass |
| `relay-dsh-plugin-semantic-router` | `0.2.3-rc.2` | pass |
| `relay-dsh-plugin-monitors` | `0.3.2-rc.2` | pass |
| `relay-dsh-plugin-monitor-time` | `0.1.2-rc.2` | pass |
| `relay-dsh-plugin-monitor-process` | `0.1.2-rc.2` | pass |
| `relay-dsh-plugin-monitor-author` | `0.1.2-rc.2` | pass |

Workbench, Files, and Terminal are retired. They were intentionally excluded
from source adaptation, packaging, and the maintained compatibility matrix.

Codex, Claude, and Events required targeted compatibility changes. Codex now
accepts durable `assistant/chunk` and transient `assistant/live-chunk` events,
both persistence read response shapes, v3 history headers, and settlement
messages carrying `stream`. Claude emits the newer settlement shape, and Events
uses the explicit official Session-list state contract where alpha inference is
no longer sufficient. The remaining plugins required peer and release metadata
updates only. Session Import has no DSH package peer.

## Upstream change audit

The release replaces `agent/session-start` with asynchronous `agent/created` and
deprecates synchronous Session history APIs. Relay already used `agent/created`,
but Codex needed to unwrap the newer persistence read result and accept the new
live Assistant transport while retaining the rc.2 event forms.

The release also adds official Web terminal, file-preview, and sidebar
capabilities. Those reinforce the existing retirement decision for Relay's
Workbench, Files, and Terminal plugins and do not overlap the 10 maintained
plugins above.

## Reproducible validation

Complete `--maintained-only` runs were executed against the published
`@deepseek-ai/dsh@0.1.6-alpha.1` CLI, including the final npm-published candidate
set shown above:

1. Existing artifacts rebuilt against the already verified `0.1.5-rc.2`
   declaration graph were installed and run on `0.1.6-alpha.1`.
2. All 10 packages were rebuilt against the published `0.1.6-alpha.1`
   declaration graph, packed, installed into fresh profiles, and run again.

Both runs passed all 11 scenarios:

- `manager-only`
- `session-import-only`
- `router-only`
- `monitors-only`
- `event-plugins`
- `monitor-author`
- `events-only`
- `codex-only`
- `claude-only`
- `codex-and-claude`
- `maintained-full-composition`

The checks cover tarball installation, DSH composition, host boot, browser
module loading, client registration, session create/open, Codex preset/model
synchronization, durable HTTP Event ingestion, duplicate identity handling,
semantic routing, timer delivery, and Monitor Author installation. The full
composition contains all 10 maintained plugins together.

Run the maintained matrix with an exact prepared DSH SDK graph:

```bash
DSH_ROOT=/path/to/immutable/deepseek-harness \
DSH_BUILD_ROOT=/path/to/prepared/0.1.6-alpha.1/declaration-graph \
DSH_BIN=/path/to/@deepseek-ai/dsh/lib/bin.js \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome \
node scripts/verify-dsh-official-install.mjs --maintained-only
```

The earlier `0.1.5-rc.2` run remains recorded in
[`../dsh-0.1.5-rc.2-20260915/README.md`](../dsh-0.1.5-rc.2-20260915/README.md).

## Non-blocking install warnings

Some disposable profiles still report peer warnings unrelated to the DSH
version range: the profile-level React peer requested by `lucide-react`, and
Semantic Router's `@deepseek-ai/schemastery` peer. They did not prevent install,
composition, host activation, browser loading, or the functional checks above.
