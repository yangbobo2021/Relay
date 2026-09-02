import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ProcessHandleAuthority, createProcessCapabilityProvider } from "../src/process-capability.mjs";

test("MB07-001/002/003/006/007: issued Process Handle binds real PID/start identity/Session/project and observes exit", async t => {
  const project = await mkdtemp(join(tmpdir(), "relay-process-project-"));
  const state = await mkdtemp(join(tmpdir(), "relay-process-state-"));
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { cwd: project, stdio: "ignore" });
  t.after(() => { if (child.exitCode == null) child.kill("SIGKILL"); });
  const authority = new ProcessHandleAuthority({ identityFile: join(state, "identity.json") });
  const authorization = { sessionId: "owner", cwd: project };
  const issued = await authority.issue({ pid: child.pid, authorization });
  assert.equal(issued.pid, child.pid);
  assert.match(issued.identity, new RegExp(`:${child.pid}:`, "u"));
  assert.equal((await authority.status({ handle: issued.handle, authorization })).status, "running");
  await assert.rejects(authority.status({ handle: issued.handle, authorization: { sessionId: "attacker", cwd: project } }), error => error?.errorClass === "process_not_authorized");
  await assert.rejects(authority.status({ handle: `${issued.handle}x`, authorization }), error => error?.errorClass === "invalid_handle");
  child.kill("SIGTERM");
  await new Promise(resolve => child.once("exit", resolve));
  const exited = await authority.status({ handle: issued.handle, authorization });
  assert.equal(exited.status, "exited");
  assert.equal(exited.exit_code_available, false);
});

test("MB07-005: PID reuse is identity_lost, never a false process exit", async () => {
  const project = await mkdtemp(join(tmpdir(), "relay-process-reuse-project-"));
  let observed = { uid: process.getuid(), cwd: project, start_identity: "start-a" };
  const authority = new ProcessHandleAuthority({
    identityFile: join(await mkdtemp(join(tmpdir(), "relay-process-reuse-")), "identity.json"),
    inspectProcess: async () => observed,
  });
  const authorization = { sessionId: "owner", cwd: project };
  const issued = await authority.issue({ pid: 123, authorization });
  observed = { ...observed, start_identity: "start-b" };
  await assert.rejects(authority.status({ handle: issued.handle, authorization }), error => error?.errorClass === "identity_lost");
});

test("MB04-003/MB07-001: Process provider exposes only read-only status and rejects raw PID grants", async () => {
  const authority = new ProcessHandleAuthority({
    identityFile: join(await mkdtemp(join(tmpdir(), "relay-process-provider-")), "identity.json"),
    inspectProcess: async () => null,
  });
  const provider = createProcessCapabilityProvider(authority);
  assert.deepEqual(Object.keys(provider.operations), ["status"]);
  assert.equal(provider.operations.status.class, "read");
  assert.equal(provider.operations.status.parameters.properties.pid, undefined);
  await assert.rejects(provider.execute({ operation: "kill", arguments: {}, authorization: {} }), error => error?.errorClass === "operation_unavailable");
});
