import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";

export class CodexAppServerClient extends EventEmitter {
  constructor({ command = "codex", args = ["app-server"], requestTimeoutMs = 30_000 } = {}) {
    super();
    this.command = command;
    this.args = args;
    this.requestTimeoutMs = requestTimeoutMs;
    this.process = null;
    this.nextRequestId = 1;
    this.pending = new Map();
    this.closed = false;
  }

  async start() {
    if (this.process) return;
    this.closed = false;
    this.process = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const output = readline.createInterface({ input: this.process.stdout });
    output.on("line", (line) => this.handleLine(line));
    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (chunk) => this.emit("diagnostic", String(chunk)));
    this.process.once("error", (error) => this.failAll(error));
    this.process.once("exit", (code, signal) => {
      this.process = null;
      if (!this.closed) {
        this.failAll(new Error(`codex app-server exited (${signal ?? code})`));
      }
      this.emit("exit", { code, signal });
    });

    await this.request("initialize", {
      clientInfo: {
        name: "relay_codex",
        title: "Relay Codex",
        version: "1.0.0",
      },
      capabilities: {
        experimentalApi: true,
        mcpServerOpenaiFormElicitation: true,
        requestAttestation: false,
      },
    });
    this.notify("initialized", {});
  }

  request(method, params = {}, { timeoutMs = this.requestTimeoutMs } = {}) {
    if (!this.process?.stdin?.writable) {
      return Promise.reject(new Error("codex app-server is not running"));
    }
    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      this.write({ method, id, params });
    });
  }

  notify(method, params = {}) {
    this.write({ method, params });
  }

  respond(id, result) {
    this.write({ id, result });
  }

  respondError(id, code, message) {
    this.write({ id, error: { code, message } });
  }

  async close() {
    this.closed = true;
    this.failAll(new Error("codex app-server client closed"));
    if (!this.process) return;
    const child = this.process;
    this.process = null;
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      this.emit("diagnostic", `invalid app-server JSON: ${error.message}\n${line}`);
      return;
    }

    if (message.id != null && ("result" in message || "error" in message)) {
      const pending = this.pending.get(message.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) {
          const error = new Error(message.error.message ?? `${pending.method} failed`);
          error.code = message.error.code;
          error.data = message.error.data;
          pending.reject(error);
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    if (message.id != null && message.method) {
      this.emit("serverRequest", message);
      return;
    }
    if (message.method) {
      this.emit("notification", message);
    }
  }

  write(message) {
    if (!this.process?.stdin?.writable) {
      throw new Error("codex app-server is not running");
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  failAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
