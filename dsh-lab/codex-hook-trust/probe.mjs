import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CodexAppServerClient } from "../../integrations/codex/app-server-client.mjs";
import { CodexSessionRuntime } from "../../integrations/codex/session-runtime.mjs";
import { resolveCodexLaunch } from "../../integrations/codex/codex-command.mjs";

// A local Responses stub removes model choice and credentials from this comparison.
const root = mkdtempSync(join(tmpdir(), "relay-hook-trust-probe-"));
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const launch = resolveCodexLaunch({ env: {} });
const output = process.argv[2] ? resolve(process.argv[2]) : join(root, "results.json");
const results = [];
let active;
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!req.url.endsWith("/responses")) {
    res.writeHead(404); res.end("not found"); return;
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  active.requests += 1;
  active.toolNames = (body.tools ?? []).map(t => t.name ?? t.type);
  active.toolOutputs.push(...(body.input ?? [])
    .filter(item => item.type === "function_call_output").map(item => item.output));
  const id = `probe-response-${active.requests}`;
  const item = active.requests === 1
    ? { type: "function_call", call_id: "probe-shell", name: "exec_command",
      arguments: JSON.stringify({ cmd: active.command, workdir: active.workspace, yield_time_ms: 1000 }) }
    : { type: "message", role: "assistant", id: "probe-done",
      content: [{ type: "output_text", text: "PROBE_COMPLETE" }] };
  const events = [
    { type: "response.created", response: { id } },
    { type: "response.output_item.done", item },
    { type: "response.completed", response: { id, usage: {
      input_tokens: 0, output_tokens: 0, total_tokens: 0,
      input_tokens_details: null, output_tokens_details: null,
    } } },
  ];
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;

function fixture(name, matcher = "^Bash$") {
  const dir = join(root, name);
  const home = join(dir, "home");
  const workspace = join(dir, "workspace");
  const plugin = join(home, "plugins/cache/probe/relay-hook-probe/local");
  for (const path of [workspace, join(plugin, ".codex-plugin"), join(plugin, "hooks")]) {
    mkdirSync(path, { recursive: true });
  }
  const log = join(dir, "hook.jsonl");
  writeFileSync(join(plugin, ".codex-plugin/plugin.json"), JSON.stringify({
    name: "relay-hook-probe", version: "0.0.1", description: "Isolated trust propagation probe",
  }));
  const command = `${JSON.stringify(process.execPath)} "${plugin}/hooks/probe.mjs"`;
  writeFileSync(join(plugin, "hooks/hooks.json"), JSON.stringify({ hooks: {
    SessionStart: [{ hooks: [{ type: "command", command, timeout: 5 }] }],
    PreToolUse: [{ matcher, hooks: [{ type: "command", command, timeout: 5 }] }],
  }, }));
  writeFileSync(join(plugin, "hooks/probe.mjs"), `
import { appendFileSync } from 'node:fs';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const event = JSON.parse(Buffer.concat(chunks).toString('utf8'));
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ event: event.hook_event_name,
  tool: event.tool_name, input: event.tool_input, pluginRoot: process.env.PLUGIN_ROOT }) + '\\n');
if (event.hook_event_name === 'PreToolUse' && JSON.stringify(event.tool_input).includes('HOOK_BLOCK_PROBE')) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: 'PreToolUse', permissionDecision: 'deny',
    permissionDecisionReason: 'RELAY_HOOK_TRUST_PROBE_BLOCKED'
  } }));
}
`);
  writeFileSync(join(home, "config.toml"), `
model = "gpt-5.6-sol"
model_provider = "hook-probe"
approval_policy = "never"
sandbox_mode = "workspace-write"
check_for_update_on_startup = false
[analytics]
enabled = false
[feedback]
enabled = false
[features]
plugins = true
hooks = true
remote_plugin = false
shell_snapshot = false
[plugins."relay-hook-probe@probe"]
enabled = true
[model_providers.hook-probe]
name = "Local deterministic hook probe"
base_url = "${baseUrl}"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
`);
  return { name, home, workspace, log, requests: 0, toolOutputs: [], toolNames: [],
    command: "/usr/bin/printf 'HOOK_BLOCK_PROBE\\n' > blocked.txt" };
}

function finish(f, extra) {
  const logs = existsSync(f.log) ? readFileSync(f.log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [];
  const result = { name: f.name, ...extra, requests: f.requests,
    hookEvents: logs.map(r => ({ event: r.event, tool: r.tool,
      fromInstalledPlugin: r.pluginRoot?.includes("plugins/cache/probe/relay-hook-probe/local") === true })),
    targetExists: existsSync(join(f.workspace, "blocked.txt")),
    denyReturned: JSON.stringify(f.toolOutputs).includes("RELAY_HOOK_TRUST_PROBE_BLOCKED"),
    toolOutputs: f.toolOutputs,
  };
  results.push(result);
  console.log(JSON.stringify({ name: result.name, requests: result.requests,
    registeredHooks: result.registeredHooks?.length, hookEvents: result.hookEvents,
    targetExists: result.targetExists, denyReturned: result.denyReturned }));
}

function isolatedEnv(f) {
  return { PATH: process.env.PATH, HOME: f.home, CODEX_HOME: f.home,
    TMPDIR: root, LANG: "en_US.UTF-8", NO_PROXY: "127.0.0.1,localhost" };
}

async function cli() {
  const f = fixture("cli-bypass"); active = f;
  const args = [...launch.argsPrefix, "--dangerously-bypass-hook-trust", "exec", "--json",
    "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", f.workspace,
    "Run the requested local fixture command once."];
  const child = spawn(launch.command, args, { env: isolatedEnv(f), stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", c => { stdout += c; });
  child.stderr.on("data", c => { stderr += c; });
  const timeout = setTimeout(() => child.kill("SIGTERM"), 45000);
  const exit = await new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", resolve); });
  clearTimeout(timeout);
  writeFileSync(join(root, f.name, "cli.jsonl"), stdout);
  writeFileSync(join(root, f.name, "stderr.txt"), stderr);
  finish(f, { exit });
  assert.equal(exit, 0, stderr);
}

async function appServer(name, { flag = true, requestTrust = false, runtime = false, matcher } = {}) {
  const f = fixture(name, matcher); active = f;
  const originalEnv = process.env;
  process.env = isolatedEnv(f);
  const args = [...(flag ? ["--dangerously-bypass-hook-trust"] : []), "app-server"];
  const client = new CodexAppServerClient({ args, capabilities: { experimentalApi: true },
    clientInfo: { name: "relay_hook_probe", version: "0.0.1" } });
  const notifications = [], diagnostics = [], requests = [];
  const originalRequest = client.request.bind(client);
  client.request = (method, params, options) => {
    if (method.startsWith("thread/")) requests.push({ method, config: params?.config });
    return originalRequest(method, params, options);
  };
  client.on("notification", message => notifications.push(message));
  client.on("diagnostic", text => diagnostics.push(text));
  client.on("serverRequest", request => client.respondError(request.id, -32601, "No approval expected in isolated probe"));
  try {
    await client.start();
    const listed = await client.request("hooks/list", { cwds: [f.workspace] });
    const registered = listed.data.flatMap(entry => entry.hooks);
    let thread;
    if (runtime) {
      const adapterRuntime = new CodexSessionRuntime({ client, cwd: f.workspace });
      const session = await adapterRuntime.createSession({ model: "gpt-5.6-sol", effort: "low", approvalPolicy: "never" });
      thread = { id: session.id };
    } else {
      const response = await client.request("thread/start", {
        cwd: f.workspace, model: "gpt-5.6-sol", modelProvider: "hook-probe",
        approvalPolicy: "never", sandbox: "workspace-write",
        config: requestTrust ? { bypass_hook_trust: true } : {},
      });
      thread = response.thread;
    }
    let timeout;
    const completed = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("turn timeout")), 45000);
      client.on("notification", m => {
        if (m.method === "turn/completed" && m.params?.threadId === thread.id) resolve(m.params.turn);
      });
    });
    try {
      await client.request("turn/start", { threadId: thread.id,
        input: [{ type: "text", text: "Run the requested local fixture command once.", text_elements: [] }] });
      const turn = await completed;
      finish(f, { turnStatus: turn.status, flag, manualRequestTrust: requestTrust,
        registeredHooks: registered, lifecycleRequests: requests,
        hookNotifications: notifications.filter(n => n.method.startsWith("hook/")).map(n => ({ method: n.method, params: n.params })),
      });
      assert.equal(turn.status, "completed", JSON.stringify(turn));
    } finally { clearTimeout(timeout); }
  } finally {
    await client.close();
    process.env = originalEnv;
    writeFileSync(join(root, f.name, "events.json"), JSON.stringify(notifications, null, 2));
    writeFileSync(join(root, f.name, "stderr.txt"), diagnostics.join(""));
  }
}

try {
  console.log(`Isolated artifacts: ${root}`);
  await cli();
  await appServer("server-launch-only");
  await appServer("server-launch-only-all-tools", { matcher: "*" });
  await appServer("server-request-trust", { requestTrust: true });
  await appServer("server-request-only", { flag: false, requestTrust: true });
  await appServer("relay-runtime-explicit-trust", { runtime: true });
  await appServer("relay-runtime-default", { flag: false, runtime: true });
  for (const result of results) {
    const expectedBlock = ["cli-bypass", "server-request-trust", "server-request-only", "relay-runtime-explicit-trust"].includes(result.name);
    assert.equal(result.requests, 2, result.name);
    if (result.registeredHooks) {
      assert.equal(result.registeredHooks.length, 2, result.name);
      assert.ok(result.registeredHooks.every(h => h.source === "plugin" && h.enabled
        && h.pluginId === "relay-hook-probe@probe"), result.name);
    }
    assert.equal(result.targetExists, !expectedBlock, result.name);
    assert.equal(result.denyReturned, expectedBlock, result.name);
    assert.equal(result.hookEvents.some(e => e.event === "PreToolUse"), expectedBlock, result.name);
    if (expectedBlock) {
      assert.ok(result.hookEvents.some(e => e.event === "PreToolUse" && e.tool === "Bash"
        && e.fromInstalledPlugin), result.name);
    }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  mkdirSync(dirname(output), { recursive: true });
  const report = JSON.stringify({
    generatedAt: new Date().toISOString(), artifacts: "<RUN_ROOT> (printed during execution)",
    codexVersion: execFileSync(launch.command, [...launch.argsPrefix, "--version"], { encoding: "utf8" }).trim(),
    pluginCommit: execFileSync("git", ["-C", join(repo, "integrations/codex"), "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    model: "local deterministic Responses stub; no real inference or credentials", results,
  }, null, 2);
  writeFileSync(output, report
    .replaceAll(`/private${root}`, "<RUN_ROOT>")
    .replaceAll(root, "<RUN_ROOT>")
    .replaceAll(process.execPath, "<NODE>") + "\n");
  console.log(`Results: ${output}`);
}
