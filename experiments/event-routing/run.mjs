#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertFixtureSuite, evaluatePredictions } from "./evaluation.mjs";
import {
  routeByMetadata,
  routeSinglePass,
  routeTwoPass,
} from "./routing.mjs";
import { createCodexCliRoutingAdapter } from "../../integrations/codex/routing-adapter.mjs";

const experimentDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentDirectory, "../..");
const fixturePath = resolve(repositoryRoot, "fixtures/email-routing/cases.json");
const decisionSchemaPath = resolve(repositoryRoot, "packages/event-router/decision.schema.json");
const recallSchemaPath = resolve(experimentDirectory, "recall.schema.json");
const implementationPaths = [
  resolve(experimentDirectory, "routing.mjs"),
  resolve(experimentDirectory, "evaluation.mjs"),
  resolve(repositoryRoot, "packages/event-router/decision.mjs"),
  resolve(repositoryRoot, "packages/event-router/semantic.mjs"),
  resolve(repositoryRoot, "integrations/codex/routing-adapter.mjs"),
  decisionSchemaPath,
  recallSchemaPath,
];

const options = parseArgs(process.argv.slice(2));
const fixtureText = await readFile(fixturePath, "utf8");
const suite = JSON.parse(fixtureText);
assertFixtureSuite(suite);
const implementationText = (
  await Promise.all(implementationPaths.map((path) => readFile(path, "utf8")))
).join("\n");

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.listCases) {
  for (const caseData of suite.cases) {
    console.log(`${caseData.id}\t${caseData.description}`);
  }
  process.exit(0);
}

const cases = selectCases(suite.cases, options.caseIds);
const routerNames = options.router === "all"
  ? ["metadata", "single", "two"]
  : [options.router];
const replayReport = options.replay
  ? JSON.parse(await readFile(resolve(repositoryRoot, options.replay), "utf8"))
  : null;
const needsModel = !replayReport && routerNames.some((name) => name !== "metadata");
const adapter = needsModel
  ? createCodexCliRoutingAdapter({ model: options.model, timeoutMs: options.timeoutMs })
  : null;

const report = {
  generated_at: new Date().toISOString(),
  fixture: {
    suite: suite.suite,
    version: suite.version,
    sha256: createHash("sha256").update(fixtureText).digest("hex"),
    selected_cases: cases.map((caseData) => caseData.id),
  },
  experiment: {
    sha256: createHash("sha256").update(implementationText).digest("hex"),
  },
  adapter: adapter
    ? { name: adapter.name, model: adapter.model }
    : replayReport?.adapter ?? { name: "none", model: null },
  replayed_from: options.replay ?? null,
  routers: {},
};

for (const routerName of routerNames) {
  console.error(`${replayReport ? "Replaying" : "Running"} ${routerName} router for ${cases.length} case(s)...`);
  const predictions = replayReport
    ? loadReplayPredictions(replayReport, routerName, cases)
    : await runRouter(routerName, cases, {
        adapter,
        concurrency: options.concurrency,
        decisionSchemaPath,
        recallSchemaPath,
      });
  report.routers[routerName] = evaluatePredictions(cases, predictions);
}

printSummary(report);

if (options.output) {
  const outputPath = resolve(repositoryRoot, options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nReport: ${outputPath}`);
}

if (options.failOnGates) {
  const failed = Object.values(report.routers).some((router) =>
    Object.values(router.gates).some((passed) => !passed),
  );
  if (failed) {
    process.exitCode = 1;
  }
}

async function runRouter(routerName, selectedCases, context) {
  const predictions = new Map();
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= selectedCases.length) {
        return;
      }

      const caseData = selectedCases[index];
      const startedAt = Date.now();
      try {
        let result;
        if (routerName === "metadata") {
          result = routeByMetadata(caseData);
        } else if (routerName === "single") {
          result = await routeSinglePass(caseData, context);
        } else if (routerName === "two") {
          result = await routeTwoPass(caseData, context);
        } else {
          throw new Error(`unknown router ${routerName}`);
        }
        predictions.set(caseData.id, result);
        console.error(
          `[${routerName}] ${caseData.id}: ${result.decision.disposition} (${Date.now() - startedAt} ms)`,
        );
      } catch (error) {
        predictions.set(caseData.id, { error: error.stack ?? error.message });
        console.error(`[${routerName}] ${caseData.id}: ERROR ${error.message}`);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(context.concurrency, selectedCases.length) },
      () => worker(),
    ),
  );
  return predictions;
}

function parseArgs(args) {
  const parsed = {
    router: "metadata",
    caseIds: [],
    concurrency: 1,
    model: null,
    timeoutMs: 180_000,
    output: null,
    replay: null,
    failOnGates: false,
    listCases: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--router") {
      parsed.router = requiredValue(args, ++index, argument);
    } else if (argument === "--case") {
      parsed.caseIds.push(...requiredValue(args, ++index, argument).split(","));
    } else if (argument === "--concurrency") {
      parsed.concurrency = positiveInteger(requiredValue(args, ++index, argument), argument);
    } else if (argument === "--model") {
      parsed.model = requiredValue(args, ++index, argument);
    } else if (argument === "--timeout-ms") {
      parsed.timeoutMs = positiveInteger(requiredValue(args, ++index, argument), argument);
    } else if (argument === "--output") {
      parsed.output = requiredValue(args, ++index, argument);
    } else if (argument === "--replay") {
      parsed.replay = requiredValue(args, ++index, argument);
    } else if (argument === "--fail-on-gates") {
      parsed.failOnGates = true;
    } else if (argument === "--list-cases") {
      parsed.listCases = true;
    } else if (argument === "--help" || argument === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`unknown argument ${argument}`);
    }
  }

  if (!["metadata", "single", "two", "all"].includes(parsed.router)) {
    throw new Error(`invalid --router ${parsed.router}`);
  }
  return parsed;
}

function loadReplayPredictions(sourceReport, routerName, selectedCases) {
  const source = sourceReport.routers?.[routerName];
  if (!source) {
    throw new Error(`replay report does not contain router ${routerName}`);
  }
  const sourceCases = new Map(source.cases.map((result) => [result.case_id, result]));
  return new Map(
    selectedCases.map((caseData) => {
      const result = sourceCases.get(caseData.id);
      if (!result) {
        return [caseData.id, { error: "case is missing from replay report" }];
      }
      if (result.error) {
        return [caseData.id, { error: result.error }];
      }
      return [
        caseData.id,
        {
          decision: result.decision,
          telemetry: result.telemetry,
        },
      ];
    }),
  );
}

function selectCases(allCases, caseIds) {
  if (caseIds.length === 0) {
    return allCases;
  }
  const selected = allCases.filter((caseData) => caseIds.includes(caseData.id));
  const missing = caseIds.filter((caseId) => !selected.some((caseData) => caseData.id === caseId));
  if (missing.length > 0) {
    throw new Error(`unknown case ID(s): ${missing.join(", ")}`);
  }
  return selected;
}

function requiredValue(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function positiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} requires a positive integer`);
  }
  return parsed;
}

function printSummary(reportData) {
  const rows = Object.entries(reportData.routers).map(([name, result]) => ({
    router: name,
    disposition_accuracy: result.metrics.disposition_accuracy,
    actionable_coverage: result.metrics.actionable_coverage,
    target_recall: result.metrics.target_recall,
    wrong_target_cases: result.metrics.wrong_target_cases,
    escalate_overhead_cases: result.metrics.escalate_overhead_cases,
    model_calls: result.metrics.model_calls,
    total_tokens: result.metrics.input_tokens + result.metrics.output_tokens,
    gates_passed: Object.values(result.gates).every(Boolean),
  }));
  console.table(rows);
}

function printHelp() {
  console.log(`Usage: npm run eval:routing -- [options]

Options:
  --router metadata|single|two|all  Router to evaluate (default: metadata)
  --case ID[,ID]                   Run only selected fixture cases
  --concurrency N                  Concurrent case workers (default: 1)
  --model ID                       Override the configured Codex CLI model
  --timeout-ms N                   Timeout for each model call (default: 180000)
  --output PATH                    Write the full JSON report
  --replay PATH                    Re-evaluate decisions from an existing report
  --fail-on-gates                  Exit nonzero when a release gate fails
  --list-cases                     List fixture IDs
  --help                           Show this help`);
}
