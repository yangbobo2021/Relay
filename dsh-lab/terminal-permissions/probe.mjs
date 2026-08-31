// Live, read-only SSH regression against a supplied Codex binary and built plugin.
// No model turn is created. Only a disposable local write probe is created/removed.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { CodexAppServerClient } from "../../integrations/codex/app-server-client.mjs";

const { values } = parseArgs({ options: {
  codex: { type: "string" }, ssh: { type: "string" }, cwd: { type: "string" },
  plugin: { type: "string", default: fileURLToPath(new URL("../../integrations/dsh-terminal/lib/host-plugin.js", import.meta.url)) },
} });
assert.ok(values.codex && values.ssh && values.cwd, "required: --codex /path/to/codex --ssh user@host --cwd /workspace");
assert.ok(!values.ssh.startsWith("-"), "SSH target must not be an option");
const pluginUrl = pathToFileURL(resolve(values.plugin));
const { Context } = await import(pathToFileURL(createRequire(pluginUrl).resolve("@deepseek-ai/cordis")));
const plugin = await import(pluginUrl);
const client = new CodexAppServerClient({ command: values.codex });
const cwd = resolve(values.cwd);
const scratch = await mkdtemp(join(homedir(), ".relay-terminal-verification-"));
const file = join(scratch, "write-test");
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const ssh = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=yes", "-o", "UpdateHostKeys=no", values.ssh, "exit"];
const ctx = new Context();
ctx.provide("agents", {});
ctx.provide("typert", { lookups: new Map([["agent", { resolve: async () => ({ session: { header: { cwd } } }) }]]) });
let fiber;

try {
  await client.start();
  const before = await client.request("command/exec", { command: ssh, cwd, timeoutMs: 10000 });
  assert.equal(before.exitCode, 255);
  assert.match(before.stderr, /Operation not permitted/);
  console.log("PASS default policy reproduces SSH denial (exit 255)");

  fiber = ctx.plugin(plugin);
  await fiber;
  ctx.relayTerminalProviders.register({
    id: "codex-app-server", title: "Codex App Server", whenReady: async () => {},
    request: client.request.bind(client),
    subscribeNotification(listener) {
      client.on("notification", listener);
      return () => client.off("notification", listener);
    },
  });
  const gateway = ctx.relayWorkbenchTerminal;
  const spawned = await gateway.spawn({ sessionId: "terminal-permission-probe" });
  assert.equal(spawned.ok, true);
  const target = { sessionId: "terminal-permission-probe", terminalId: spawned.value.sessionId };
  await until(() => gateway.readRaw(target), result => /[%$#>]\s*$/.test(stripAnsi(result.value.text)));
  assert.equal((await gateway.resize({ ...target, cols: 120, rows: 32 })).ok, true);
  const command = "unset HISTFILE; " + ssh.map(quote).join(" ")
    + '; result=$?; printf "\\nSSH_EXIT=%s\\n" "$result"; printf terminal-write-ok > '
    + quote(file) + '; printf "\\nWRITE_EXIT=%s\\n" "$?"; stty size; exit "$result"\r';
  assert.equal((await gateway.input({ ...target, data: command })).ok, true);
  const listed = await until(() => gateway.list({ sessionId: target.sessionId }), result => result.value[0].status.kind === "exited");
  const output = (await gateway.readRaw(target)).value.text;
  assert.equal(listed.value[0].status.exitCode, 0);
  assert.match(output, /SSH_EXIT=0/);
  assert.match(output, /WRITE_EXIT=0/);
  assert.match(output, /32 120/);
  assert.doesNotMatch(output, /Operation not permitted/);
  assert.equal(await readFile(file, "utf8"), "terminal-write-ok");
  console.log("PASS built plugin: SSH exit 0, home-directory write, PTY resize 120x32, clean shell exit");

  const after = await client.request("command/exec", { command: ssh, cwd, timeoutMs: 10000 });
  assert.equal(after.exitCode, 255);
  assert.match(after.stderr, /Operation not permitted/);
  console.log("PASS same server retains its default restrictions after the manual terminal exits");
} finally {
  try { await fiber?.dispose(); }
  finally { await client.close(); await rm(scratch, { recursive: true, force: true }); }
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

async function until(read, predicate) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const result = await read();
    assert.equal(result.ok, true);
    if (predicate(result)) return result;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("terminal probe timed out");
}
