import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { Context } from "@deepseek-ai/cordis";
import { RelayEventsService } from "../../integrations/events/events-service.js";
import * as monitorPlugin from "../../integrations/monitors/host-plugin.js";
import * as processPlugin from "../../integrations/monitor-process/host-plugin.js";

test("MB07-002/003/004/008: Agent-authored process Bundle survives Relay restart and wakes the same Session once", async t => {
  const root = await mkdtemp(join(tmpdir(), "relay-process-e2e-"));
  const project = join(root, "project");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(project);
  t.after(() => rm(root, { recursive: true, force: true }));
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { cwd: project, stdio: "ignore" });
  t.after(() => { if (child.exitCode == null) child.kill("SIGKILL"); });

  const config = {
    databasePath: join(root, "events.sqlite"),
    artifactDirectory: join(root, "artifacts"),
    identityFile: join(root, "process-identity.json"),
    project,
  };
  const first = await host(config);
  const issued = await first.tools.get("relay_issue_process_handle").execute({ pid: child.pid });
  const validated = await first.tools.get("relay_validate_monitor_bundle").execute({
    source: processBundleSource(),
    manifest: processManifest(issued.handle),
  });
  const installed = await first.tools.get("relay_install_monitor_bundle").execute({
    validation_id: validated.validationId,
    task_summary: "Wait for the controlled child process to exit.",
    resume_prompt: "The process exited; continue the remaining work.",
  });
  const monitorId = installed.monitorIds[0];
  assert.equal(first.events.inspectMonitor(monitorId).last_observation.data.status, "running");
  assert.equal(first.accepted.length, 0);
  await first.dispose();

  const second = await host(config);
  child.kill("SIGTERM");
  await new Promise(resolve => child.once("exit", resolve));
  const triggered = await second.events.checkMonitor(monitorId, { force: true });
  assert.equal(triggered.status, "triggered");
  assert.equal(second.accepted.length, 1);
  assert.equal(second.accepted[0].sessionId, "process-session");
  assert.equal(second.accepted[0].deliveries[0].event.type, "process.exited");
  assert.equal((await second.events.checkMonitor(monitorId, { force: true })).status, "inactive");
  assert.equal(second.accepted.length, 1);
  await second.dispose();
});

async function host(config) {
  const ctx = new Context();
  const tools = new Map();
  const accepted = [];
  const agent = {
    id: "process-session",
    session: { header: { cwd: config.project } },
    ctx: { tools: { register(definition) {
      assert.equal(tools.has(definition.name), false, `duplicate tool ${definition.name}`);
      tools.set(definition.name, definition);
      return () => tools.delete(definition.name);
    } } },
  };
  ctx.provide("agents", { roots: () => [agent] });
  ctx.provide("tools", {});
  await ctx.plugin(monitorPlugin, { pollIntervalMs: 60_000, artifactDirectory: config.artifactDirectory });
  await ctx.plugin(processPlugin, { identityFile: config.identityFile });
  let events;
  await ctx.plugin({ name: "process-e2e-events", apply(scope) {
    events = new RelayEventsService(scope, {
      databasePath: config.databasePath,
      dispatchPollIntervalMs: 60_000,
      inbox: { async deliver(input) { accepted.push(input); } },
    });
    scope.effect(() => () => events.stop());
  } });
  await eventually(() => events.monitorProvider && tools.has("relay_install_monitor_bundle") && tools.has("relay_issue_process_handle"));
  return { ctx, events, tools, accepted, async dispose() { await ctx.fiber.dispose(); } };
}

function processBundleSource() {
  return `globalThis.monitor={
    observe(context){return {provider:"process.read",operation:"status",arguments:{handle:context.config.handle}}},
    detect(previous,current){return previous?.status==="running"&&current.status==="exited"?[{type:"process.exited",key:current.identity,data:current}]:[]}
  }`;
}

function processManifest(handle) {
  return {
    contract_version: 1,
    type_id: "custom.process-exit",
    event_types: ["process.exited"],
    capability_grants: [{ provider: "process.read", operation: "status", arguments: { handle } }],
    config: { handle },
    lifecycle: "one_shot",
    schedule: { interval_seconds: 1, jitter_seconds: 0 },
    expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    observation_schema: { type: "object", additionalProperties: false, required: ["identity", "status", "exit_code_available"], properties: {
      identity: { type: "string" }, status: { enum: ["running", "exited"] }, exit_code_available: { const: false },
    } },
    event_data_schema: { type: "object", additionalProperties: false, required: ["identity", "status", "exit_code_available"], properties: {
      identity: { type: "string" }, status: { const: "exited" }, exit_code_available: { const: false },
    } },
    locales: {
      "en-US": { name: "Process exit", description: "Wait for a controlled process to exit.", permissions: "Reads one authorized process identity.", remediation: "Issue a new process Handle." },
      "zh-CN": { name: "进程退出", description: "等待受控进程退出。", permissions: "读取一个已授权的进程身份。", remediation: "请重新签发进程 Handle。" },
    },
  };
}

async function eventually(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(predicate(), "Cordis process-monitor composition did not settle");
}
