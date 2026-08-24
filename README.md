# Relay

Relay is the waiting and external-event subsystem for long-running Agent work.

An ordinary DSH conversation can register Waits and durable local Monitors. Relay
routes incoming Events back into that conversation. A DSH Session may use DSH's
default Agent or bind a Codex Thread as its execution and model-context backend.

## Initial Layout

```text
apps/                         User-facing Relay applications
packages/                     Runtime modules
integrations/                 External systems and agent/tool bridges
docs/                         Specification, architecture, and decisions
experiments/                  Short-lived prototypes
fixtures/                     Sanitized test fixtures
scripts/                      Developer automation
tests/                        Cross-package and integration tests
upstream/deepseek-harness/    Local ignored clone of DeepSeek Harness
dsh-lab/                      Relay-owned DSH notes, tests, patches, adapters
```

## DeepSeek Harness Workspace

Clone DSH into the ignored upstream directory:

```bash
scripts/sync-dsh.sh
```

Use `dsh-lab/` for Relay-owned experiments and compatibility notes so the upstream clone can be updated freely.

## Documentation

Start with the [documentation index](docs/README.md). Product requirements and
runtime behavior are defined by the [Relay specification](docs/spec/README.md).

## DSH Plugin Catalog

Relay tracks several independently installable DeepSeek Harness plugins. Each
plugin can be installed on official DSH without checking out this Relay
repository, while Relay pins the plugin repositories as submodules for
distribution, compatibility testing, and cross-plugin validation.

See the [complete plugin chooser and installation guide](docs/dsh-plugins.md)
([中文](docs/dsh-plugins.zh.md)) for npm and GitHub setup recipes, dependencies,
verification, and a real DSH UI demo.

| Plugin | Repository | npm package | Purpose |
| --- | --- | --- | --- |
| Codex | [`relay-dsh-plugin-codex`](https://github.com/yangbobo2021/relay-dsh-plugin-codex) | [`relay-dsh-plugin-codex`](https://www.npmjs.com/package/relay-dsh-plugin-codex) | Adds Codex as a DSH conversation backend. |
| Claude Code | [`relay-dsh-plugin-claude`](https://github.com/yangbobo2021/relay-dsh-plugin-claude) | [`relay-dsh-plugin-claude`](https://www.npmjs.com/package/relay-dsh-plugin-claude) | Adds Claude Code as a DSH conversation backend. |
| Workbench | [`relay-dsh-plugin-workbench`](https://github.com/yangbobo2021/relay-dsh-plugin-workbench) | [`relay-dsh-plugin-workbench`](https://www.npmjs.com/package/relay-dsh-plugin-workbench) | Provides the shared right/bottom panel shell for DSH view plugins. |
| Files | [`relay-dsh-plugin-files`](https://github.com/yangbobo2021/relay-dsh-plugin-files) | [`relay-dsh-plugin-files`](https://www.npmjs.com/package/relay-dsh-plugin-files) | Adds a right-side workspace file browser. |
| Terminal | [`relay-dsh-plugin-terminal`](https://github.com/yangbobo2021/relay-dsh-plugin-terminal) | [`relay-dsh-plugin-terminal`](https://www.npmjs.com/package/relay-dsh-plugin-terminal) | Adds a bottom terminal panel and provider registry. |
| Events | local package `integrations/deepseek-harness` | `@relay/plugin-events` | Adds optional Relay Wait/Event/Monitor runtime integration. |

The individual plugin READMEs link back here and describe their boundary with
Relay. Relay's repository workflow for these submodules is documented in
[Repository Workflow](docs/spec/repository-workflow.md).

## Local Vertical Demo

Run the full fixture-to-Runtime path without a model call:

```bash
npm run demo:worker -- --router expected --reset
```

Use `--router semantic` to route the same sanitized event through the configured
Codex CLI model. See the [Worker CLI guide](apps/relay-worker/README.md) for options.

## Relay Web

After cloning DSH, start its Web conversation UI with the local Relay bundle:

```bash
npm run start:web -- --host 127.0.0.1 --port 4317
```

Open `http://127.0.0.1:4317`, choose a workspace, and start an ordinary conversation.
Choose the directly visible **Codex** mode on the native New Session screen to run
the conversation through Codex App Server without leaving DSH Web. The Codex
Session keeps DSH's native composer, model/reasoning selector, permission control,
Chat/Trajectory views and message rendering. Choose another mode before the first
message for the ordinary DSH path.

An ordinary DSH Agent can call `relay_schedule_timer` with `after_seconds` and a
continuation prompt; Relay persists the timer and resumes the same DSH Session when
it expires. A Codex-backed Session can register an external-event Wait in its native
conversation view; that Event path does not create a timer or Codex Automation.

Local integrations deliver a real external Event through the running DSH Web host:

```bash
curl -X POST http://127.0.0.1:4317/api/relay/events \
  -H 'content-type: application/json' \
  -d '{"type":"build.completed","source_event_id":"build-42","status":"passed"}'
```

Non-loopback callers must send `Authorization: Bearer <token>` and the host must set
`RELAY_INGRESS_TOKEN`. The response includes the durable Relay Event and Delivery
states; an unmatched Event is accepted without starting a Session turn.

Open **Settings > Waiting events** to inspect live waits and Monitors, open the
owning conversation, cancel its waits, or ask an active Monitor to check now.

The [Codex in DSH Web specification](docs/spec/codex-app-server.md) defines this
integration and its ownership boundary.
