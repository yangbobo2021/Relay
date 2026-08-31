import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CodexAppServerClient, RELAY_CODEX_APP_SERVER_ARGS } from "../../integrations/codex/app-server-client.mjs";
import { CodexSessionRuntime } from "../../integrations/codex/session-runtime.mjs";
import { resolveCodexLaunch } from "../../integrations/codex/codex-command.mjs";

// Real Guard and Codex execution, with a local model stub and disposable state.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const guard = resolve(process.argv[2] ?? "");
const controlOnly = process.argv[4] === "control-only";
const dshControlOnly = process.argv[4] === "dsh-control";
const smokeCommand = process.env.HOL_SMOKE_COMMAND ?? "rm -rf ~/hol-guard-smoke";
const trustReviewedHooks = process.env.HOL_SMOKE_TRUST_REVIEWED === "1";
const trustArgs = trustReviewedHooks ? ["--dangerously-bypass-hook-trust"] : [];
assert.ok(["rm -rf ~/hol-guard-smoke", "rm -r ~/hol-guard-smoke", "rm -r ./hol-guard-smoke", "printf GUARD_SAFE_COMMAND"].includes(smokeCommand));
assert.ok(process.argv[2] && (controlOnly || dshControlOnly || existsSync(guard)), "pass the isolated hol-guard executable");
const root = realpathSync(mkdtempSync(join(tmpdir(), "relay-hol-smoke-")));
const output = resolve(process.argv[3] ?? join(root, "results.json"));
const launch = resolveCodexLaunch({ env: {} });
const results = [];
let active;
const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (!req.url.endsWith("/responses")) { res.writeHead(404); res.end(); return; }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    active.requests += 1;
    const isTitleRequest = (body.input ?? []).some(item => (Array.isArray(item.content)
      ? item.content.map(block => block.text ?? "").join("\n") : String(item.content ?? ""))
      .includes("Generate the session title from this JSON array of human messages"));
    if (isTitleRequest) active.titleRequests += 1;
    else active.mainRequests += 1;
    const declared = [...(body.tools ?? []), ...(body.input ?? [])
      .filter(item => item.type === "additional_tools").flatMap(item => item.tools ?? [])];
    const functions = declared.find(tool => tool.type === "namespace" && tool.name === "functions");
    active.toolNames = [...new Set([...active.toolNames, ...declared.flatMap(tool => tool.tools
      ? tool.tools.map(child => `${tool.name}.${child.name}`) : [tool.name ?? tool.type])])];
    writeFileSync(join(active.dir, `model-request-${active.requests}.json`), JSON.stringify(body, null, 2));
    active.toolOutputs.push(...(body.input ?? []).filter(item => ["function_call_output", "custom_tool_call_output"].includes(item.type)).map(item => item.output));
    assert.ok(active.requests <= 6, "unexpected model retry");
    const args = { cmd: active.command, workdir: active.workspace, shell: "/bin/bash", login: false, yield_time_ms: 1000 };
    const shellCall = functions?.tools?.some(tool => tool.type === "custom" && tool.name === "exec")
      ? { type: "custom_tool_call", call_id: "guard-smoke-shell", name: "exec", namespace: "functions",
        input: `const result = await tools.exec_command(${JSON.stringify(args)}); text(result);` }
      : { type: "function_call", call_id: "guard-smoke-shell", name: "exec_command", arguments: JSON.stringify(args) };
    const item = !isTitleRequest && active.mainRequests === 1
      ? shellCall
      : { type: "message", role: "assistant", id: "guard-smoke-done",
        content: [{ type: "output_text", text: isTitleRequest ? "Guard smoke test" : "GUARD_SMOKE_COMPLETE" }] };
    const id = `guard-smoke-${active.requests}`;
    const events = [
      { type: "response.created", response: { id } },
      { type: "response.output_item.done", item },
      { type: "response.completed", response: { id, usage: {
        input_tokens: 0, output_tokens: 0, total_tokens: 0,
        input_tokens_details: null, output_tokens_details: null,
      } } },
    ];
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
  } catch (error) { res.writeHead(500); res.end(error.message); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;

function envFor(f) {
  return { PATH: `${dirname(guard)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: f.home, CODEX_HOME: join(f.home, ".codex"), TMPDIR: root,
    XDG_CONFIG_HOME: join(f.home, ".config"), XDG_CACHE_HOME: join(f.home, ".cache"),
    LANG: "en_US.UTF-8", NO_PROXY: "127.0.0.1,localhost",
    PYTHON_KEYRING_BACKEND: "keyring.backends.null.Keyring" };
}

async function run(command, args, f, label, input = "") {
  const child = spawn(command, args, { cwd: f.workspace, env: envFor(f), stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.stdin.end(input);
  const timer = setTimeout(() => child.kill("SIGTERM"), 90000);
  const killTimer = setTimeout(() => child.kill("SIGKILL"), 95000);
  try {
    const exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject); child.once("exit", resolve);
    });
    writeFileSync(join(f.dir, `${label}.stdout`), stdout);
    writeFileSync(join(f.dir, `${label}.stderr`), stderr);
    return { exitCode, stdout, stderr };
  } finally { clearTimeout(timer); clearTimeout(killTimer); }
}

async function guardCommand(f, args, label, input) {
  return run(guard, [...args, "--home", f.home, "--guard-home", f.guardHome], f, label, input);
}

async function fixture(name) {
  const dir = join(root, name), home = join(dir, "home");
  const workspace = smokeCommand.includes("./hol-guard-smoke") ? join(dir, "workspace") : home;
  const f = { name, dir, home, workspace, guardHome: join(dir, "guard-state"),
    target: join(workspace, "hol-guard-smoke"), requests: 0, mainRequests: 0, titleRequests: 0, toolOutputs: [], toolNames: [] };
  mkdirSync(join(home, ".codex"), { recursive: true, mode: 0o700 });
  mkdirSync(f.guardHome, { recursive: true, mode: 0o700 });
  writeFileSync(join(f.guardHome, "config.toml"),
    'desktop_notifications = false\napproval_surface_policy = "native-only"\ntelemetry = false\nsync = false\n');
  mkdirSync(f.target, { recursive: true });
  writeFileSync(join(f.target, "sentinel.txt"), "DISPOSABLE_HOL_GUARD_SMOKE\n");
  // Both variants target only this fixture's disposable directory.
  f.command = smokeCommand;
  assert.ok(f.target.startsWith(`${root}/`) && f.home !== process.env.HOME);
  writeFileSync(join(home, ".codex/config.toml"), `
model = "gpt-5.6-sol"
model_provider = "guard-smoke"
approval_policy = "never"
sandbox_mode = "workspace-write"
check_for_update_on_startup = false
[analytics]
enabled = false
[feedback]
enabled = false
[features]
hooks = true
shell_snapshot = false
remote_plugin = false
[model_providers.guard-smoke]
name = "Local deterministic Guard smoke test"
base_url = "${baseUrl}"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
`);
  return f;
}

async function install(f) {
  const version = await run(guard, ["--version"], f, "guard-version");
  f.guardVersion = version.stdout.trim();
  const installed = await guardCommand(f, ["install", "codex", "--json"], "install");
  assert.equal(installed.exitCode, 0, installed.stderr || installed.stdout);
  f.install = JSON.parse(installed.stdout);
  f.guardInstalled = true;
  f.configSha256 = createHash("sha256").update(readFileSync(join(f.home, ".codex/config.toml"))).digest("hex");
  const preflight = await run(guard, ["command", "test", f.command, "--json"], f, "preflight");
  f.preflight = { exitCode: preflight.exitCode, stdout: preflight.stdout, stderr: preflight.stderr };
  console.log(JSON.stringify({ name: f.name, preflightExit: preflight.exitCode }));
}

async function collect(f, extra = {}) {
  const receipts = f.guardInstalled ? await guardCommand(f, ["receipts", "--json"], "receipts") : { stdout: "null" };
  const events = f.guardInstalled ? await guardCommand(f, ["events", "--json"], "guard-events") : { stdout: "null" };
  const parse = result => { try { return JSON.parse(result.stdout); } catch { return result; } };
  const result = { name: f.name, command: f.command, ...extra,
    trustReviewedHooks,
    guardVersion: f.guardVersion,
    requests: f.requests, toolNames: f.toolNames, toolOutputs: f.toolOutputs,
    mainRequests: f.mainRequests, titleRequests: f.titleRequests,
    targetExists: existsSync(f.target), sentinelExists: existsSync(join(f.target, "sentinel.txt")),
    configSha256: f.configSha256, preflight: f.preflight,
    receipts: parse(receipts), events: parse(events) };
  results.push(result);
  console.log(JSON.stringify({ name: f.name, requests: f.requests, targetExists: result.targetExists,
    toolOutputs: f.toolOutputs, error: extra.error }));
  if (f.guardInstalled) await guardCommand(f, ["daemon", "stop", "--json"], "daemon-stop");
  return result;
}

async function cli() {
  const f = await fixture("codex-cli"); active = f;
  try {
    await install(f);
    const execution = await run(launch.command, [...launch.argsPrefix, ...trustArgs, "exec", "--json",
      "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", f.workspace,
      "Run the supplied disposable-directory smoke test once."], f, "codex-cli");
    await collect(f, { exitCode: execution.exitCode, stderr: execution.stderr });
  } catch (error) { await collect(f, { error: error.stack }); throw error; }
}

async function control() {
  const f = await fixture("codex-cli-no-guard"); active = f;
  const execution = await run(launch.command, [...launch.argsPrefix, "exec", "--json",
    "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", f.workspace,
    "Run the supplied disposable-directory smoke test once."], f, "codex-cli");
  const result = { name: f.name, command: f.command, exitCode: execution.exitCode,
    requests: f.requests, toolNames: f.toolNames, toolOutputs: f.toolOutputs,
    targetExists: existsSync(f.target), sentinelExists: existsSync(join(f.target, "sentinel.txt")) };
  results.push(result);
  console.log(JSON.stringify(result));
  assert.equal(execution.exitCode, 0, execution.stderr);
  assert.equal(f.requests, 2);
  if (smokeCommand === "printf GUARD_SAFE_COMMAND") {
    assert.ok(JSON.stringify(f.toolOutputs).includes("GUARD_SAFE_COMMAND"));
  } else if (!smokeCommand.startsWith("rm -rf")) {
    assert.equal(result.targetExists, false, "non-force control must remove the disposable directory");
  } else if (result.targetExists) {
    assert.match(JSON.stringify(f.toolOutputs), /rm -f style commands are not permitted/);
  }
}

async function runtime() {
  const f = await fixture("relay-runtime"); active = f;
  await install(f);
  const originalEnv = process.env;
  process.env = envFor(f);
  const client = new CodexAppServerClient({ args: [...trustArgs, "app-server"],
    capabilities: { experimentalApi: true }, clientInfo: { name: "relay_guard_smoke", version: "0.0.1" } });
  const notifications = [], diagnostics = [], lifecycleRequests = [];
  const originalRequest = client.request.bind(client);
  client.request = (method, params, options) => {
    if (method.startsWith("thread/")) lifecycleRequests.push({ method, params });
    return originalRequest(method, params, options);
  };
  client.on("notification", message => notifications.push(message));
  client.on("diagnostic", message => diagnostics.push(message));
  client.on("serverRequest", request => client.respondError(request.id, -32601, "No approvals in isolated smoke test"));
  let timer;
  try {
    await client.start();
    const listed = await client.request("hooks/list", { cwds: [f.workspace] });
    const adapter = new CodexSessionRuntime({ client, cwd: f.workspace });
    const session = await adapter.createSession({ model: "gpt-5.6-sol", effort: "low", approvalPolicy: "never" });
    const completed = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("turn timeout")), 90000);
      client.on("notification", message => {
        if (message.method === "turn/completed" && message.params?.threadId === session.id) resolve(message.params.turn);
      });
    });
    await client.request("turn/start", { threadId: session.id,
      input: [{ type: "text", text: "Run the supplied disposable-directory smoke test once.", text_elements: [] }] });
    const turn = await completed;
    await collect(f, { turnStatus: turn.status, registeredHooks: listed, lifecycleRequests,
      hookNotifications: notifications.filter(message => message.method.startsWith("hook/")) });
  } catch (error) { await collect(f, { error: error.stack }); throw error; }
  finally {
    clearTimeout(timer);
    await client.close();
    process.env = originalEnv;
    writeFileSync(join(f.dir, "protocol-events.json"), JSON.stringify(notifications, null, 2));
    writeFileSync(join(f.dir, "diagnostics.txt"), diagnostics.join(""));
  }
}

async function dsh(withGuard = true) {
  const f = await fixture(withGuard ? "dsh-host" : "dsh-host-no-guard"); active = f;
  if (withGuard) await install(f);
  const dshRoot = join(repo, "upstream/deepseek-harness");
  const home = join(f.dir, "dsh-home"), profile = join(home, "profiles/web");
  const modules = join(profile, "node_modules");
  mkdirSync(modules, { recursive: true });
  for (const [name, path] of [["relay-dsh-plugin-codex", "integrations/codex"],
    ["relay-dsh-plugin-session-import", "integrations/session-import"]]) {
    symlinkSync(join(repo, path), join(modules, name));
  }
  writeFileSync(join(profile, "package.json"), JSON.stringify({ name: "dsh-profile-guard-smoke", private: true,
    dependencies: { "relay-dsh-plugin-codex": "*", "relay-dsh-plugin-session-import": "*" },
    dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "relay-dsh-plugin-codex"] } } }));
  writeFileSync(join(profile, "cordis.yml"), "[]\n");
  writeFileSync(join(profile, "cordis.patch.yml"), JSON.stringify(trustReviewedHooks && withGuard
    ? [{ id: "relay-codex-host", config: { codexArgs: [...trustArgs, ...RELAY_CODEX_APP_SERVER_ARGS] } }]
    : []));
  writeFileSync(join(home, "settings.yaml"), "permission:\n  defaultPreset: workspace-write\n");
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const { InProcessApiClient } = await import(pathToFileURL(join(dshRoot,
    "packages/host/apiproxy/lib/types/fetch/client.js")));
  const api = new InProcessApiClient({ fetch: (url, init) => fetch(new URL(new URL(url).pathname, base), init) });
  const nativeApprovals = [];
  let mux, muxTask = Promise.resolve(), muxError;
  const child = spawn(process.execPath, ["--expose-internals", join(dshRoot, "apps/cli/lib/bin.js"),
    "web", "--no-open", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: f.workspace, env: { ...envFor(f), DSH_HOME: home, DSH_TELEMETRY_DISABLED: "1",
    RELAY_CODEX_LINK_PATH: join(f.dir, "links.json") }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", chunk => { log += chunk; });
  child.stderr.on("data", chunk => { log += chunk; });
  const rpc = async (method, payload) => {
    const response = await fetch(`${base}/api/${method}`, { method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "client-request", rpcId: randomUUID(), method, payload }),
      signal: AbortSignal.timeout(30000) });
    const body = await response.json();
    assert.equal(body.result?.ok, true, `${method}: ${JSON.stringify(body)}`);
    return body.result.value;
  };
  const until = async (check, timeout = 90000) => {
    const deadline = Date.now() + timeout;
    while (!await check()) {
      if (child.exitCode !== null) throw new Error(`DSH exited ${child.exitCode}: ${log.slice(-2500)}`);
      if (Date.now() > deadline) throw new Error(`DSH timeout: ${log.slice(-2500)}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };
  try {
    await until(() => log.includes(base));
    const { workspace } = await rpc("workspace.create", { path: f.workspace });
    const { sessionId } = await rpc("session.create", { workspaceId: workspace.workspaceId, agentPreset: "relay-codex" });
    await rpc("session.selectModel", { sessionId, provider: "relay-codex", model: "gpt-5.6-sol", reasoningEffort: "low" });
    // The web host uses a WebSocket downlink and HTTP responses, not public SSE.
    mux = new WebSocket(`${base.replace("http:", "ws:")}/api/events.mux`);
    mux.addEventListener("message", ({ data }) => {
      muxTask = muxTask.then(async () => {
        const envelope = JSON.parse(data), frame = envelope.payload;
        if (envelope.type !== "server-request" || frame.type !== "approval/requested" || frame.sessionId !== sessionId) return;
        const receipt = await api.respond({ type: "client-response", rpcId: envelope.rpcId,
          result: { ok: true, value: { sessionId, approvalId: frame.approvalId, outcome: "rejected" } } });
        assert.equal(receipt.accepted, true);
        nativeApprovals.push({ ...frame, testResponse: "rejected" });
      }).catch(error => { muxError = error; });
    });
    await new Promise((resolve, reject) => {
      mux.addEventListener("open", resolve, { once: true });
      mux.addEventListener("error", reject, { once: true });
    });
    await rpc("session.prompt", { sessionId, mode: "queue", content: [{ type: "text",
      text: "Run the supplied disposable-directory smoke test once." }] });
    let history;
    await until(async () => {
      if (muxError) throw muxError;
      history = await rpc("session.history", { sessionId });
      return history.events.some(({ event }) => event.type === "turn/end");
    });
    writeFileSync(join(f.dir, "dsh-history.json"), JSON.stringify(history, null, 2));
    const threadId = JSON.parse(readFileSync(join(f.dir, "links.json"))).sessions[sessionId].threadId;
    const result = await collect(f, { sessionId, threadId, nativeApprovals, turnEnd: history.events.findLast(({ event }) => event.type === "turn/end"),
      dshCommit: execFileSync("git", ["-C", dshRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() });
    assert.equal(f.mainRequests, 2, "exactly one shell call and one final response in the main DSH turn");
    if (withGuard && trustReviewedHooks && smokeCommand.startsWith("rm ")) {
      assert.equal(nativeApprovals.length, 0, "Guard must block before any test rejection of native approval");
      assert.ok(result.receipts.items.some(receipt => receipt.policy_decision === "block"
        && receipt.action_envelope_json?.event_name === "PreToolUse"
        && receipt.action_envelope_json?.raw_payload_redacted?.session_id === threadId),
      "Guard deny receipt must belong to the main DSH thread, not the title generator");
    }
    if (!withGuard && !smokeCommand.startsWith("rm -rf") && smokeCommand.startsWith("rm ")) {
      assert.equal(result.targetExists, false, "DSH no-Guard control must remove its disposable directory");
    }
  } catch (error) { await collect(f, { error: error.stack }); throw error; }
  finally {
    mux?.close();
    await muxTask;
    writeFileSync(join(f.dir, "dsh-host.log"), log);
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once("exit", resolve));
      child.kill("SIGINT");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      await exited; clearTimeout(timer);
    }
  }
}

try {
  console.log(`Isolated artifacts: ${root}`);
  await control();
  if (dshControlOnly) await dsh(false);
  else if (!controlOnly) {
    await cli();
    await runtime();
    await dsh();
  }
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  await new Promise(resolve => server.close(resolve));
  const git = path => execFileSync("git", ["-C", path, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const report = { generatedAt: new Date().toISOString(), artifacts: "<RUN_ROOT>",
    codexVersion: execFileSync(launch.command, [...launch.argsPrefix, "--version"], { encoding: "utf8" }).trim(),
    pluginVersion: JSON.parse(readFileSync(join(repo, "integrations/codex/package.json"))).version,
    pluginCommit: git(join(repo, "integrations/codex")),
    model: "local deterministic Responses stub; no model account or credentials",
    scope: controlOnly || dshControlOnly ? "No-Guard controls" : "CLI, plugin runtime, and official DSH host via session RPC; local model stub", results };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2).replaceAll(`/private${root}`, "<RUN_ROOT>")
    .replaceAll(root, "<RUN_ROOT>").replaceAll(repo, "<RELAY_REPO>")
    .replaceAll(dirname(dirname(guard)), "<GUARD_VENV>") + "\n");
  console.log(`Results: ${output}`);
}
