import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, cp, mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

// Runs a real, separate official DSH host. Never changes the source profile.
const { values } = parseArgs({ options: { ...Object.fromEntries([
  "dsh-bin", "profile-source", "codex-command", "candidate-tarball", "artifacts", "workspace", "label", "question-file", "model", "effort",
].map(name => [name, { type: "string" }])), probe: { type: "boolean", default: false } } });
for (const name of ["dsh-bin", "profile-source", "codex-command", "artifacts", "workspace", "label"]) {
  assert.ok(values[name], `--${name} is required`);
}
const run = resolve(values.artifacts);
const home = join(run, "home");
const profile = join(home, "profiles/web");
const modules = join(profile, "node_modules");
const source = resolve(values["profile-source"]);
await mkdir(modules, { recursive: true, mode: 0o700 });
await chmod(run, 0o700);
await cp(join(source, "package.json"), join(profile, "package.json"));
await writeFile(join(profile, "cordis.yml"), "[]\n");
await writeFile(join(profile, "cordis.patch.yml"), `- id: relay-codex-host\n  config:\n    codexCommand: ${JSON.stringify(resolve(values["codex-command"]))}\n`);
await writeFile(join(home, "settings.yaml"), "permission:\n  defaultPreset: danger-full-access\n");
for (const entry of await readdir(join(source, "node_modules"))) {
  if (entry === "relay-dsh-plugin-codex") continue;
  await symlink(join(source, "node_modules", entry), join(modules, entry));
}
const installed = join(modules, "relay-dsh-plugin-codex");
if (values["candidate-tarball"]) {
  await mkdir(installed);
  await cp(resolve(values["candidate-tarball"]), join(run, "candidate.tgz"));
  execFileSync("tar", ["-xzf", join(run, "candidate.tgz"), "--strip-components=1", "-C", installed]);
} else {
  await cp(join(source, "node_modules/relay-dsh-plugin-codex"), installed, { recursive: true });
}
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, DSH_HOME: home, RELAY_CODEX_COMMAND: resolve(values["codex-command"]),
  RELAY_CODEX_LINK_PATH: join(run, "links.json") };
const child = spawn(process.execPath, ["--expose-internals", resolve(values["dsh-bin"]), "web", "--no-open", "--host", "127.0.0.1", "--port", String(port)],
  { cwd: resolve(values.workspace), env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", c => { log += c; });
child.stderr.on("data", c => { log += c; });
const result = { label: values.label, run, base, hostPid: child.pid,
  workspace: resolve(values.workspace), question: values["question-file"] ? await readFile(resolve(values["question-file"]), "utf8") : "新增的与RELAY紧密相关的3个新插件已经发布了吗？",
  codexVersion: execFileSync(resolve(values["codex-command"]), ["--version"], { encoding: "utf8" }).trim(),
  candidateTarball: values["candidate-tarball"] ?? null };
result.codexBinarySha256 = createHash("sha256").update(await readFile(resolve(values["codex-command"]))).digest("hex");
result.installedHostSha256 = createHash("sha256").update(await readFile(join(installed, "lib/host-plugin.js"))).digest("hex");
let sessionId;
try {
  await until(async () => {
    if (child.exitCode !== null) throw new Error(`DSH exited with ${child.exitCode}; see host.log`);
    return log.includes(base);
  }, 60000);
  console.log(JSON.stringify({ event: "host-ready", base, label: values.label }));
  const { workspace } = await rpc("workspace.create", { path: result.workspace });
  ({ sessionId } = await rpc("session.create", { workspaceId: workspace.workspaceId, agentPreset: "relay-codex" }));
  result.sessionId = sessionId;
  await rpc("session.rename", { sessionId, title: values.label });
  await rpc("session.selectModel", { sessionId, provider: "relay-codex", model: values.model ?? "gpt-5.6-sol", reasoningEffort: values.effort ?? "high" });
  const initial = await rpc("session.history", { sessionId });
  const preset = initial.events.map(x => x.event).filter(x => x.type === "permission/preset").at(-1);
  assert.equal(preset?.data.preset, "danger-full-access", "test must match the full-access baseline");
  result.sentAt = new Date().toISOString();
  await rpc("session.prompt", { sessionId, mode: "queue", content: [{ type: "text", text: result.question }] });
  console.log(JSON.stringify({ event: "prompt-sent", sessionId, label: values.label }));
  let history;
  await until(async () => {
    history = await rpc("session.history", { sessionId });
    return history.events.some(x => x.event.type === "turn/end");
  }, 300000);
  result.finishedAt = new Date().toISOString();
  await writeFile(join(run, "history.json"), JSON.stringify(history, null, 2));
  const events = history.events.map(x => x.event);
  result.turnEnd = events.findLast(x => x.type === "turn/end")?.data;
  result.activities = events.filter(x => x.type === "tool/result").map(x => x.data.meta?.codexActivity).filter(Boolean);
  result.threadId = result.activities[0]?.threadId;
  result.finalMessages = events.filter(x => x.type === "assistant/message")
    .map(x => x.data.message).filter(x => x.content?.some(b => b.type === "text"));
  console.log(JSON.stringify({ event: "complete", sessionId, threadId: result.threadId,
    activities: result.activities.length, turnEnd: result.turnEnd, label: values.label }));
  if (values.probe) {
    // Separate from the unchanged benchmark question and its first-turn metrics.
    const text = "请只使用 DSH 的 plugin_discover 工具，以 inspect 检查 relay-dsh-plugin-events 一次，并报告返回结果。不要安装，不要用其他查询替代。这是工具结果展示验证。";
    await rpc("session.prompt", { sessionId, mode: "queue", content: [{ type: "text", text }] });
    let probe;
    await until(async () => {
      probe = await rpc("session.history", { sessionId });
      return probe.events.filter(x => x.event.type === "turn/end").length >= 2;
    }, 180000);
    await writeFile(join(run, "probe-history.json"), JSON.stringify(probe, null, 2));
    const activities = probe.events.map(x => x.event).filter(e => e.type === "tool/result" && e.data.turn === 2)
      .map(e => e.data.meta?.codexActivity?.activity).filter(a => a?.type === "dynamicToolCall");
    result.probe = { question: text, activities };
    assert.ok(activities.some(a => a.output?.includes("404") && a.status === "error"), "real dynamic 404 must retain its error detail");
    console.log(JSON.stringify({ event: "dynamic-result-probe-passed", activities: activities.length }));
  }
} catch (error) {
  result.error = error.stack;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  await writeFile(join(run, "result.json"), JSON.stringify(result, null, 2));
  await writeFile(join(run, "host.log"), log);
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill("SIGINT");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited; clearTimeout(timer);
  }
}

async function rpc(method, payload) {
  const response = await fetch(`${base}/api/${method}`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "client-request", rpcId: randomUUID(), method, payload }), signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  assert.equal(body.result?.ok, true, `${method}: ${JSON.stringify(body)}`);
  return body.result.value;
}
async function until(predicate, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (!await predicate()) {
    if (Date.now() > end) throw new Error(`Timed out after ${timeoutMs}ms`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}
