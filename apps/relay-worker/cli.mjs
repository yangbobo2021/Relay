#!/usr/bin/env node

import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { runFixtureWorker } from "./fixture-worker.mjs";

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const databasePath = options.databasePath === ":memory:"
  ? ":memory:"
  : resolve(process.cwd(), options.databasePath);
if (databasePath !== ":memory:") {
  await mkdir(dirname(databasePath), { recursive: true });
  if (options.reset) {
    await rm(databasePath, { force: true });
  }
}

const result = await runFixtureWorker({
  fixtureId: options.fixtureId,
  databasePath,
  routerMode: options.routerMode,
  model: options.model,
  timeoutMs: options.timeoutMs,
});

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printResult(result);
}

function parseArgs(args) {
  const parsed = {
    fixtureId: "reply_with_reliable_thread_metadata",
    databasePath: ".tmp/relay-worker.sqlite",
    routerMode: "semantic",
    model: null,
    timeoutMs: 180_000,
    reset: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--fixture") {
      parsed.fixtureId = requiredValue(args, ++index, argument);
    } else if (argument === "--db") {
      parsed.databasePath = requiredValue(args, ++index, argument);
    } else if (argument === "--router") {
      parsed.routerMode = requiredValue(args, ++index, argument);
    } else if (argument === "--model") {
      parsed.model = requiredValue(args, ++index, argument);
    } else if (argument === "--timeout-ms") {
      parsed.timeoutMs = positiveInteger(requiredValue(args, ++index, argument), argument);
    } else if (argument === "--reset") {
      parsed.reset = true;
    } else if (argument === "--json") {
      parsed.json = true;
    } else if (argument === "--help" || argument === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`unknown argument ${argument}`);
    }
  }

  if (!new Set(["semantic", "expected"]).has(parsed.routerMode)) {
    throw new Error(`invalid --router ${parsed.routerMode}`);
  }
  return parsed;
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

function printResult(result) {
  const decision = result.event.decision;
  const attempt = result.event.routing_attempts.at(-1);
  console.log(`Fixture: ${result.fixture.id}`);
  console.log(`Router: ${result.router.name} (${result.router.model ?? "no model"})`);
  console.log(`Event: ${result.event.event_id} -> ${result.event.state}`);
  console.log(`Decision: ${decision.disposition} - ${decision.summary}`);
  console.log(`Evidence: ${decision.evidence.join("; ")}`);
  for (const delivery of result.event.deliveries) {
    console.log(
      `Delivery: ${delivery.delivery_id} -> ${delivery.session_id} (${delivery.state}), waits [${delivery.wait_ids.join(", ")}]`,
    );
  }
  for (const registration of result.registrations) {
    const activeWaits = registration.waits.filter((wait) => wait.status === "active");
    console.log(
      `Wait projection: ${registration.session_id}, active waits ${activeWaits.length}`,
    );
  }
  if (attempt?.usage) {
    console.log(
      `Model usage: ${attempt.usage.model_calls ?? 0} call(s), ${attempt.usage.input_tokens ?? 0} input + ${attempt.usage.output_tokens ?? 0} output tokens, ${attempt.usage.latency_ms ?? 0} ms`,
    );
  }
  console.log(`Database: ${result.database_path}`);
}

function printHelp() {
  console.log(`Usage: npm run demo:worker -- [options]

Options:
  --fixture ID                 Fixture case to ingest
  --router semantic|expected  Use Codex or the fixture label (default: semantic)
  --db PATH                    SQLite path (default: .tmp/relay-worker.sqlite)
  --model ID                   Override the configured Codex CLI model
  --timeout-ms N               Model call timeout (default: 180000)
  --reset                      Remove the selected database before starting
  --json                       Print the inspectable result as JSON
  --help                       Show this help`);
}
