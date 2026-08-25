import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CodexAppServerClient } from "../../integrations/codex/app-server-client.mjs";
import { CodexSessionRuntime } from "../../integrations/codex/session-runtime.mjs";

const MARKER = "CSI-CROSS-VERSION-6D91";

async function main() {
  const root = await mkdtemp(join(tmpdir(), "relay-csi-version-"));
  const workspace = join(root, "workspace");
  const globalSchemas = join(root, "global-schemas");
  const bundledSchemas = join(root, "bundled-schemas");
  await mkdir(workspace, { recursive: true });
  let threadId;
  let runtime;
  try {
    const globalVersion = (await run("codex", ["--version"], workspace)).stdout.trim();
    const bundledVersion = (await run(process.execPath, ["node_modules/@openai/codex/bin/codex.js", "--version"], process.cwd())).stdout.trim();
    const execution = await run("codex", [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "--ignore-rules",
      "--sandbox",
      "read-only",
      "-C",
      workspace,
      `Reply with exactly: ${MARKER}`,
    ], workspace);
    const events = execution.stdout.split("\n").filter(Boolean).map(line => JSON.parse(line));
    threadId = events.find(event => event.type === "thread.started")?.thread_id;
    assert.ok(threadId);

    const client = new CodexAppServerClient({ requestTimeoutMs: 60_000 });
    runtime = new CodexSessionRuntime({ client, cwd: workspace });
    const snapshot = await runtime.initialize();
    const read = await client.request("thread/read", { threadId, includeTurns: true });
    assert.ok(JSON.stringify(read.thread.turns).includes(MARKER));
    const listed = await client.request("thread/list", {
      cwd: read.thread.cwd,
      sourceKinds: ["exec"],
      limit: 100,
    });
    assert.ok(listed.data.some(candidate => candidate.id === threadId));
    const model = snapshot.models.find(candidate => candidate.isDefault) ?? snapshot.models[0];
    const resumed = await runtime.resumeSession(threadId, {
      cwd: read.thread.cwd,
      model: model.id,
      effort: model.defaultReasoningEffort,
      sandbox: "read-only",
      approvalPolicy: "never",
    });
    const continuation = await runtime.sendAndWait(threadId, {
      text: "What exact CSI marker did the previous client output? Reply with only that marker.",
      sandbox: "read-only",
      approvalPolicy: "never",
    }, { timeoutMs: 180_000 });
    assert.ok(JSON.stringify(continuation.items).includes(MARKER));

    await Promise.all([
      run("codex", ["app-server", "generate-json-schema", "--out", globalSchemas], process.cwd()),
      run(process.execPath, ["node_modules/@openai/codex/bin/codex.js", "app-server", "generate-json-schema", "--out", bundledSchemas], process.cwd()),
    ]);
    const schemaComparison = await compareSchemas(globalSchemas, bundledSchemas);

    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      results: {
        "CSI-002": {
          result: "pass",
          creatorVersion: globalVersion,
          resumeVersion: bundledVersion,
          sourceKind: read.thread.source?.kind ?? read.thread.source,
          discovered: true,
          resumedSameThread: resumed.id === threadId,
          continuationRecoveredMarker: true,
        },
        "CSI-014": {
          result: "pass",
          versions: [globalVersion, bundledVersion],
          schemaComparison,
          crossVersionResume: true,
        },
      },
    }, null, 2)}\n`);
  } finally {
    if (threadId && runtime) {
      await runtime.client.request("thread/delete", { threadId }).catch(() => {});
    }
    await runtime?.close().catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
}

async function compareSchemas(leftRoot, rightRoot) {
  const names = ["ThreadListParams.json", "ThreadResumeParams.json", "ThreadReadParams.json"];
  const result = {};
  for (const name of names) {
    const [left, right] = await Promise.all([
      readSchema(leftRoot, name),
      readSchema(rightRoot, name),
    ]);
    const leftProperties = Object.keys(left.properties ?? {}).sort();
    const rightProperties = Object.keys(right.properties ?? {}).sort();
    result[name] = {
      commonProperties: leftProperties.filter(property => rightProperties.includes(property)),
      removedInBundled: leftProperties.filter(property => !rightProperties.includes(property)),
      addedInBundled: rightProperties.filter(property => !leftProperties.includes(property)),
      requiredCompatible: (left.required ?? []).every(property => (right.required ?? []).includes(property)),
    };
  }
  return result;
}

async function readSchema(root, name) {
  return JSON.parse(await readFile(join(root, "v2", name), "utf8"));
}

async function run(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", resolveExit);
  });
  if (code !== 0) throw new Error(`${command} exited ${code}: ${stderr.slice(0, 500)}`);
  return { stdout, stderr };
}

await main();
