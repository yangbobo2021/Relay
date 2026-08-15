import assert from "node:assert/strict";
import test from "node:test";

import { CodexAppServerClient } from "../app-server-client.mjs";

test("JSON-RPC requests resolve, reject, and time out with their method context", async () => {
  const writes = [];
  const client = new CodexAppServerClient({ requestTimeoutMs: 15 });
  client.process = {
    stdin: {
      writable: true,
      write: (line) => writes.push(JSON.parse(line)),
    },
  };

  const resolved = client.request("model/list");
  client.handleLine(JSON.stringify({ id: writes[0].id, result: { data: [] } }));
  assert.deepEqual(await resolved, { data: [] });

  const rejected = client.request("thread/resume");
  client.handleLine(JSON.stringify({
    id: writes[1].id,
    error: { code: -32_000, message: "thread missing", data: { threadId: "x" } },
  }));
  await assert.rejects(rejected, (error) => {
    assert.equal(error.code, -32_000);
    assert.deepEqual(error.data, { threadId: "x" });
    return /thread missing/.test(error.message);
  });

  await assert.rejects(client.request("turn/start"), /turn\/start timed out after 15ms/);
  client.process = null;
});

test("invalid protocol lines remain diagnostic and server requests stay interactive", () => {
  const client = new CodexAppServerClient();
  const diagnostics = [];
  const requests = [];
  client.on("diagnostic", (message) => diagnostics.push(message));
  client.on("serverRequest", (message) => requests.push(message));

  client.handleLine("not-json");
  client.handleLine(JSON.stringify({
    id: "approval-1",
    method: "item/commandExecution/requestApproval",
    params: { command: "pwd" },
  }));

  assert.match(diagnostics[0], /invalid app-server JSON/);
  assert.equal(requests[0].id, "approval-1");
});

test("an App Server child exit rejects initialization and reports the exit", async () => {
  const client = new CodexAppServerClient({
    command: process.execPath,
    args: ["-e", "process.stdin.resume(); setTimeout(() => process.exit(7), 20)"],
    requestTimeoutMs: 1_000,
  });
  let exit = null;
  client.on("exit", (details) => {
    exit = details;
  });

  await assert.rejects(client.start(), /codex app-server exited \(7\)/);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(exit.code, 7);
});

test("initialization advertises the experimental API required by dynamic tools", async () => {
  const fixture = [
    "const readline = require('node:readline')",
    "const input = readline.createInterface({ input: process.stdin })",
    "input.on('line', (line) => {",
    "  const message = JSON.parse(line)",
    "  if (message.method !== 'initialize') return",
    "  const capabilities = message.params.capabilities",
    "  if (capabilities.experimentalApi !== true || capabilities.requestAttestation !== false) process.exit(9)",
    "  process.stdout.write(JSON.stringify({ id: message.id, result: { userAgent: 'fixture' } }) + '\\n')",
    "})",
  ].join("\n");
  const client = new CodexAppServerClient({
    command: process.execPath,
    args: ["-e", fixture],
    requestTimeoutMs: 1_000,
  });

  await client.start();
  assert.ok(client.process);
  await client.close();
});
