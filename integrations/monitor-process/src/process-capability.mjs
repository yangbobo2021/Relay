import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, readlink, realpath, stat, writeFile } from "node:fs/promises";
import { hostname, platform, userInfo } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const executeFile = promisify(execFile);

export class ProcessHandleAuthority {
  constructor({ identityFile, inspectProcess = inspectOperatingSystemProcess, clock = () => new Date() } = {}) {
    if (typeof identityFile !== "string" || !identityFile) throw new TypeError("Process capability identityFile is required");
    this.identityFile = identityFile;
    this.inspectProcess = inspectProcess;
    this.clock = clock;
    this.identityPromise = null;
  }

  async issue({ pid, authorization }) {
    validatePid(pid);
    validateAuthorization(authorization);
    const projectRoot = await canonicalPath(authorization.cwd);
    const observed = await this.inspectProcess(pid);
    if (!observed) throw processError("process_not_found", "Process does not exist");
    if (observed.uid !== userInfo().uid) throw processError("process_not_authorized", "Process belongs to another operating-system user");
    if (!inside(projectRoot, await canonicalPath(observed.cwd))) throw processError("process_not_authorized", "Process working directory is outside the current project");
    const identity = await this.identity();
    const payload = {
      v: 1,
      host_id: identity.host_id,
      pid,
      start_identity: observed.start_identity,
      session_id: authorization.sessionId,
      project_root: projectRoot,
      issued_at: this.clock().toISOString(),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = sign(encoded, identity.key);
    return Object.freeze({
      handle: `${encoded}.${signature}`,
      identity: `${payload.host_id}:${pid}:${payload.start_identity}`,
      pid,
      startIdentity: payload.start_identity,
      projectRoot: payload.project_root,
    });
  }

  async authorize({ handle, authorization }) {
    const payload = await this.decode(handle);
    const projectRoot = await canonicalPath(authorization?.cwd).catch(() => null);
    return payload.session_id === authorization?.sessionId && payload.project_root === projectRoot;
  }

  async status({ handle, authorization }) {
    const payload = await this.decode(handle);
    const projectRoot = await canonicalPath(authorization?.cwd).catch(() => null);
    if (payload.session_id !== authorization?.sessionId || payload.project_root !== projectRoot) {
      throw processError("process_not_authorized", "Process Handle belongs to another Session or project");
    }
    const observed = await this.inspectProcess(payload.pid);
    const identity = `${payload.host_id}:${payload.pid}:${payload.start_identity}`;
    if (!observed) return { identity, status: "exited", exit_code_available: false };
    if (observed.start_identity !== payload.start_identity) {
      throw processError("identity_lost", "PID now identifies a different process");
    }
    if (observed.uid !== userInfo().uid || !inside(payload.project_root, await canonicalPath(observed.cwd))) {
      throw processError("process_not_authorized", "Process identity moved outside its authorized project");
    }
    return { identity, status: "running", exit_code_available: false };
  }

  async decode(handle) {
    if (typeof handle !== "string" || handle.length > 4096) throw processError("invalid_handle", "Process Handle is invalid");
    const [encoded, signature, extra] = handle.split(".");
    if (!encoded || !signature || extra !== undefined) throw processError("invalid_handle", "Process Handle is invalid");
    const identity = await this.identity();
    const expected = sign(encoded, identity.key);
    const suppliedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
      throw processError("invalid_handle", "Process Handle signature is invalid");
    }
    let payload;
    try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
    catch { throw processError("invalid_handle", "Process Handle payload is invalid"); }
    if (payload?.v !== 1 || payload.host_id !== identity.host_id || !Number.isSafeInteger(payload.pid)
      || typeof payload.start_identity !== "string" || typeof payload.session_id !== "string"
      || typeof payload.project_root !== "string") throw processError("invalid_handle", "Process Handle payload is invalid");
    return payload;
  }

  identity() {
    return this.identityPromise ??= loadOrCreateIdentity(this.identityFile);
  }
}

export function createProcessCapabilityProvider(authority) {
  return Object.freeze({
    api_version: 1,
    id: "process.read",
    provider_version: 1,
    operations: {
      status: {
        class: "read",
        parameters: { type: "object", additionalProperties: false, required: ["handle"], properties: { handle: { type: "string", minLength: 16, maxLength: 4096 } } },
        result: { type: "object", additionalProperties: false, required: ["identity", "status", "exit_code_available"], properties: {
          identity: { type: "string" }, status: { enum: ["running", "exited"] }, exit_code_available: { const: false },
        } },
      },
    },
    async authorize({ authorization, request }) {
      if (!request) return Boolean(authorization?.sessionId && authorization?.cwd);
      return authority.authorize({ handle: request.arguments.handle, authorization });
    },
    async execute({ operation, arguments: args, authorization }) {
      if (operation !== "status") throw processError("operation_unavailable", "Process capability supports only status");
      return authority.status({ handle: args.handle, authorization });
    },
    async health() { return "available"; },
  });
}

export async function inspectOperatingSystemProcess(pid) {
  validatePid(pid);
  if (platform() === "linux") return inspectLinuxProcess(pid);
  if (platform() === "darwin") return inspectDarwinProcess(pid);
  throw processError("platform_unsupported", `Process monitoring is unsupported on ${platform()}`);
}

async function inspectLinuxProcess(pid) {
  const root = `/proc/${pid}`;
  let statText;
  try { statText = await readFile(join(root, "stat"), "utf8"); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  const close = statText.lastIndexOf(")");
  if (close < 0) throw processError("identity_unverifiable", "Process start identity is unavailable");
  const fields = statText.slice(close + 2).split(" ");
  const startIdentity = fields[19];
  const info = await stat(root);
  const cwd = await readlink(join(root, "cwd")).catch(() => null);
  if (!startIdentity || !cwd) throw processError("identity_unverifiable", "Process identity is unavailable");
  return { uid: info.uid, cwd, start_identity: startIdentity };
}

async function inspectDarwinProcess(pid) {
  try {
    const [{ stdout: uid }, { stdout: started }, { stdout: cwdOutput }] = await Promise.all([
      executeFile("/bin/ps", ["-o", "uid=", "-p", String(pid)], { maxBuffer: 64 * 1024 }),
      executeFile("/bin/ps", ["-o", "lstart=", "-p", String(pid)], { maxBuffer: 64 * 1024 }),
      executeFile("/usr/sbin/lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { maxBuffer: 64 * 1024 }),
    ]);
    const cwd = cwdOutput.split("\n").find(line => line.startsWith("n"))?.slice(1);
    if (!uid.trim() || !started.trim() || !cwd) throw processError("identity_unverifiable", "Process identity is unavailable");
    return { uid: Number(uid.trim()), cwd, start_identity: started.trim() };
  } catch (error) {
    if (error?.code === 1) return null;
    if (error?.errorClass) throw error;
    throw processError("identity_unverifiable", "Process identity is unavailable");
  }
}

async function loadOrCreateIdentity(path) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const generated = JSON.stringify({ host_id: `${hostname()}-${randomUUID()}`, key: randomBytes(32).toString("base64url") });
  try { await writeFile(path, generated, { encoding: "utf8", mode: 0o600, flag: "wx" }); }
  catch (error) { if (error?.code !== "EEXIST") throw error; }
  await chmod(path, 0o600);
  let identity;
  try { identity = JSON.parse(await readFile(path, "utf8")); }
  catch { throw processError("identity_unverifiable", "Process capability host identity is invalid"); }
  if (typeof identity.host_id !== "string" || typeof identity.key !== "string" || identity.key.length < 32) {
    throw processError("identity_unverifiable", "Process capability host identity is invalid");
  }
  return identity;
}

function sign(value, key) {
  return createHmac("sha256", key).update(value).digest("base64url");
}

function inside(root, candidate) {
  if (typeof root !== "string" || typeof candidate !== "string" || !isAbsolute(root) || !isAbsolute(candidate)) return false;
  const suffix = relative(root, candidate);
  return suffix === "" || (!suffix.startsWith("..") && !isAbsolute(suffix));
}

async function canonicalPath(path) {
  if (typeof path !== "string" || !isAbsolute(path)) throw processError("process_not_authorized", "Absolute project path is required");
  return realpath(path);
}

function validatePid(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1 || pid > 4_194_304) throw processError("invalid_pid", "PID must be a positive safe process identifier");
}

function validateAuthorization(value) {
  if (typeof value?.sessionId !== "string" || !value.sessionId || typeof value.cwd !== "string" || !isAbsolute(value.cwd)) {
    throw processError("process_not_authorized", "Authenticated Session and absolute project directory are required");
  }
}

function processError(errorClass, message) {
  return Object.assign(new Error(message), { name: "ProcessCapabilityError", errorClass });
}
