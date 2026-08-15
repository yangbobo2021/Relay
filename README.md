# Relay

Relay is the waiting and external-event subsystem for long-running Agent work.

An ordinary DSH conversation can register Waits and durable local Monitors. Relay
routes incoming Events and injects them into that conversation's existing DSH inbox;
DSH remains responsible for conversations, user messages, and Agent execution.

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
The Agent can call `relay_schedule_timer` with `after_seconds` and a continuation
prompt; Relay persists the timer and resumes the same DSH Session when it expires.

Open **Settings > Waiting events** to inspect live waits and Monitors, open the
owning conversation, cancel its waits, or ask an active Monitor to check now.
