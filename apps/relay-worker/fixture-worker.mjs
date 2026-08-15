import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createCodexCliRoutingAdapter } from "../../integrations/codex/routing-adapter.mjs";
import { createSinglePassSemanticRouter } from "../../packages/event-router/index.mjs";
import { RelayRuntime, RelayStore } from "../../packages/runtime/index.mjs";

const appDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(appDirectory, "../..");
export const DEFAULT_FIXTURE_PATH = resolve(repositoryRoot, "fixtures/email-routing/cases.json");

export async function runFixtureWorker({
  fixtureId,
  databasePath = ":memory:",
  routerMode = "semantic",
  model,
  timeoutMs = 180_000,
  adapter,
  fixturePath = DEFAULT_FIXTURE_PATH,
} = {}) {
  assert.ok(fixtureId, "fixtureId is required");
  const suite = JSON.parse(await readFile(fixturePath, "utf8"));
  const caseData = suite.cases.find((candidate) => candidate.id === fixtureId);
  assert.ok(caseData, `unknown fixture ${fixtureId}`);
  assert.ok(!caseData.existing_event, "duplicate fixtures do not require semantic routing");
  assert.ok(
    caseData.sessions.every((session) => session.state === "waiting"),
    "the fixture worker currently seeds sleeping sessions only",
  );

  const store = new RelayStore(databasePath);
  try {
    seedSleepingSessions(store, caseData.sessions);
    const router = createRouter({ caseData, routerMode, model, timeoutMs, adapter });
    const runtime = new RelayRuntime({
      store,
      router,
      inbox: createFixtureInbox(),
      workerId: "fixture-worker",
    });
    const handled = await runtime.handleEvent(caseData.event);
    return {
      fixture: {
        id: caseData.id,
        description: caseData.description,
        expected: caseData.expected,
      },
      router: {
        mode: routerMode,
        name: router.name,
        model: router.model ?? null,
      },
      database_path: databasePath,
      event: handled.event,
      registrations: handled.registrations,
      dispatch_results: handled.dispatchResults.map(({ status, activationId, error = null }) => ({
        status,
        activation_id: activationId ?? null,
        error,
      })),
    };
  } finally {
    store.close();
  }
}

function seedSleepingSessions(store, sessions) {
  for (const session of sessions) {
    store.registerWaits({
      sessionId: session.session_id,
      taskSummary: session.task_summary,
      context: { fixture_seed: true },
      waits: session.waits.filter((wait) => wait.status === "active"),
    });
  }
}

function createRouter({ caseData, routerMode, model, timeoutMs, adapter }) {
  if (routerMode === "expected") {
    return createExpectedFixtureRouter(caseData);
  }
  assert.equal(routerMode, "semantic", `unknown router mode ${routerMode}`);
  return createSinglePassSemanticRouter({
    adapter: adapter ?? createCodexCliRoutingAdapter({ model, timeoutMs }),
  });
}

function createExpectedFixtureRouter(caseData) {
  const expected = caseData.expected;
  return {
    name: "fixture-expected",
    model: null,
    async route() {
      const waitOwner = new Map(
        caseData.sessions.flatMap((session) =>
          session.waits.map((wait) => [wait.wait_id, session.session_id]),
        ),
      );
      const waitsBySession = new Map();
      for (const waitId of expected.matched_wait_ids) {
        const sessionId = waitOwner.get(waitId);
        assert.ok(sessionId, `expected wait ${waitId} has no fixture owner`);
        const waitIds = waitsBySession.get(sessionId) ?? [];
        waitIds.push(waitId);
        waitsBySession.set(sessionId, waitIds);
      }

      const deliveries = expected.target_session_ids.map((sessionId) => ({
        session_id: sessionId,
        wait_ids: waitsBySession.get(sessionId) ?? [],
        relation: expected.reason,
        confidence: 1,
      }));
      return {
        decision: {
          disposition: expected.disposition,
          actionable: expected.disposition !== "dismiss",
          deliveries,
          evidence: [expected.reason],
          summary: expected.reason,
        },
        telemetry: emptyTelemetry(),
      };
    },
  };
}

function createFixtureInbox() {
  return {
    async deliver({ activationId, deliveries }) {
      assert.ok(deliveries.length > 0, "fixture inbox requires an event delivery");
      return { accepted: true, activationId };
    },
  };
}

function emptyTelemetry() {
  return {
    model_calls: 0,
    latency_ms: 0,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
  };
}
