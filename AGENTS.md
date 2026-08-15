# Codex Instructions For Relay

Relay is the waiting and external-event subsystem for long-running Agent work.

Relay is not a generic chatbot and not just a wrapper around an LLM API. Its purpose is to build an agent product/runtime with:

- Notification-based callbacks where sources can push, and durable local monitoring where they cannot.
- Event-triggered delivery into the correct existing DSH Session when a customer email or external webhook arrives.
- Session-authored, capability-limited Monitors for conditions in systems that cannot push events to Relay.
- Task-aware session context compression.
- Project-scoped subtask dispatch, where child agent sessions run inside the correct project directory.
- DeepSeek Harness compatibility research, validation, and selective reuse.

## Repository Layout

- `apps/` contains user-facing Relay applications such as CLI, local dashboard, workers, or API services.
- `packages/` contains reusable Relay runtime modules.
- `integrations/` contains connectors for email, webhooks, Codex, DSH, project repositories, notification systems, and external tools.
- `docs/` contains architecture notes, decisions, design docs, and operating guides.
- `experiments/` contains short-lived prototypes and validation scripts.
- `fixtures/` contains sanitized test fixtures only.
- `scripts/` contains developer automation.
- `tests/` contains cross-package and integration tests.
- `upstream/deepseek-harness/` is reserved for a local clone of `https://github.com/deepseek-ai/deepseek-harness`. Treat it as read-only upstream reference unless a task explicitly asks to patch or fork DSH.
- `dsh-lab/` contains Relay-owned notes, compatibility tests, adapters, patches, and reproduction cases related to DeepSeek Harness.

## DSH Working Rules

- Follow `docs/spec/repository-workflow.md` for DSH remote roles, durable branches,
  upstream synchronization, contribution preparation, and deletion safeguards.
- Do not copy private Relay product code into `upstream/deepseek-harness/`.
- Do not commit the cloned DSH repository into Relay. It is intentionally ignored by Git.
- Put Relay-owned DSH analysis, compatibility notes, small fixtures, and patch files under `dsh-lab/`.
- When validating DSH behavior, record the DSH commit hash in the relevant note, test, or reproduction case.
- Prefer small, reproducible experiments over broad exploratory edits.

## Engineering Direction

Relay should make asynchronous Agent work first-class while DSH owns conversations:

- An ordinary DSH conversation can register Waits and receive later external Events through its existing inbox.
- Long-running tasks should wake through callbacks, webhooks, queues, or notifications.
- When no push or query API exists, a durable local Monitor may poll through a restricted HTTP or browser capability and emit a normal Event on a meaningful state change.
- DSH owns conversation creation, history, execution, resume, and user-message ordering; Relay owns only Wait, Monitor, Event, routing, and Delivery state.
- Project dispatch should preserve each project's working directory, instructions, permissions, and artifacts.
- Runtime boundaries should stay clear: Relay routes Events, DSH Sessions own continuity and one inbox, context compression owns memory shape, and project agents own local execution.

## Content And Privacy

- Keep private customer data, real emails, secrets, credentials, and production logs out of this repository.
- Use sanitized fixtures for tests and examples.
- Keep `.env` files, local databases, generated logs, and upstream clones untracked.
