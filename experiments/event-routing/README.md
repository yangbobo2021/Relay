# Event Routing Experiment

This experiment compares metadata-only routing, one-pass semantic routing, and
two-pass recall plus adjudication against the
[email routing fixtures](../../fixtures/email-routing/README.md).

## Files

- [`run.mjs`](run.mjs) loads cases, runs routers, and writes the report.
- [`routing.mjs`](routing.mjs) contains the three routers and Codex CLI adapter.
- [`evaluation.mjs`](evaluation.mjs) validates decisions and computes metrics.
- [`packages/event-router/decision.schema.json`](../../packages/event-router/decision.schema.json)
  validates final semantic decisions shared with the runtime.
- [`recall.schema.json`](recall.schema.json) validates first-pass candidate recall.
- [`baseline-2026-08-14.md`](baseline-2026-08-14.md) records the first full-suite
  observation and recommendation.

## Usage

Run the deterministic baseline and tests without a model call:

```bash
npm test
npm run eval:routing -- --router metadata
```

Run semantic baselines with the model configured for the local Codex CLI:

```bash
npm run eval:routing -- \
  --router all \
  --concurrency 2 \
  --output .tmp/routing-report.json
```

Use `--case CASE_ID` to run one case and `--model MODEL_ID` to override the Codex
CLI model. The adapter uses ephemeral, read-only non-interactive runs and JSON Schema
output. This follows the official
[Codex CLI command reference](https://developers.openai.com/codex/cli/reference/).

After changing fixture expectations or metrics, reuse existing model decisions
without another model call:

```bash
npm run eval:routing -- \
  --router all \
  --replay .tmp/routing-report.json \
  --output .tmp/routing-report-replayed.json
```

The report contains fixture data and invented messages only. It records predictions,
decision summaries, aggregate metrics, latency, model call counts, and token usage
when the CLI exposes it. It does not retain Codex session rollouts.
