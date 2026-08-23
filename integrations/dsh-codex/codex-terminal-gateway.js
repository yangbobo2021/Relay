import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";

import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

const MAX_SCROLLBACK_BYTES = 2 * 1024 * 1024;

function success(value) {
  return { ok: true, value };
}

function rejected(code, message) {
  return { ok: false, error: { code, message } };
}

function shellCommand() {
  if (process.platform === "win32") {
    return [process.env.ComSpec || "powershell.exe"];
  }
  return [process.env.SHELL || "/bin/zsh", "-l"];
}

export class RelayCodexTerminalGateway extends TypertRemoteService {
  constructor(ctx, { terminal, client, ready, resolveAgent }) {
    super(ctx, "relayWorkbenchTerminal");
    this.terminal = terminal ?? legacyTerminalCapability(client, ready);
    this.resolveAgent = resolveAgent;
    this.terminals = new Map();
    this.byProcess = new Map();
    this.disposed = false;
    this.onNotification = (message) => this.handleNotification(message);
    this.stopNotifications = this.terminal.subscribeNotification(this.onNotification);
    ctx.effect(() => () => this.dispose(), "relay Codex workbench terminals");
  }

  async list(request) {
    return success([...this.terminals.values()]
      .filter((terminal) => terminal.sessionId === request.sessionId)
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((terminal) => this.snapshot(terminal)));
  }

  async spawn(request) {
    try {
      await this.terminal.whenReady();
      const agent = await this.resolveAgent(request.sessionId);
      const cwd = request.cwd ?? agent.session.header.cwd;
      if (!cwd) return rejected("workspace-unavailable", `session "${request.sessionId}" has no workspace cwd`);
      const terminalId = randomUUID();
      const processId = `relay-terminal-${terminalId}`;
      const terminal = {
        terminalId,
        processId,
        sessionId: request.sessionId,
        name: request.name,
        type: "codex-app-server",
        cwd,
        createdAt: Date.now(),
        status: { kind: "running" },
        decoder: new StringDecoder("utf8"),
        text: "",
        seq: 0,
        truncated: false,
      };
      this.terminals.set(terminalId, terminal);
      this.byProcess.set(processId, terminal);
      void this.run(terminal);
      return success({ ...this.snapshot(terminal), motd: "" });
    } catch (error) {
      return this.failure(error);
    }
  }

  async readRaw(request) {
    const terminal = this.owned(request);
    if (!terminal.ok) return terminal;
    return success({ text: terminal.value.text, truncated: terminal.value.truncated, seq: terminal.value.seq });
  }

  async input(request) {
    const terminal = this.owned(request);
    if (!terminal.ok) return terminal;
    if (terminal.value.status.kind !== "running") return rejected("terminal-exited", "terminal has exited");
    try {
      await this.terminal.request("command/exec/write", {
        processId: terminal.value.processId,
        deltaBase64: Buffer.from(request.data).toString("base64"),
        closeStdin: false,
      });
      return success({ accepted: true });
    } catch (error) {
      return this.failure(error);
    }
  }

  async resize(request) {
    const terminal = this.owned(request);
    if (!terminal.ok) return terminal;
    if (!Number.isSafeInteger(request.cols) || request.cols <= 0 || !Number.isSafeInteger(request.rows) || request.rows <= 0) {
      return rejected("invalid-size", "terminal rows and cols must be positive integers");
    }
    if (terminal.value.status.kind !== "running") return rejected("terminal-exited", "terminal has exited");
    try {
      await this.terminal.request("command/exec/resize", {
        processId: terminal.value.processId,
        size: { cols: request.cols, rows: request.rows },
      });
      return success({ resized: true });
    } catch (error) {
      return this.failure(error);
    }
  }

  async run(terminal) {
    try {
      const result = await this.terminal.request("command/exec", {
        command: shellCommand(),
        processId: terminal.processId,
        tty: true,
        streamStdin: true,
        streamStdoutStderr: true,
        disableOutputCap: true,
        disableTimeout: true,
        cwd: terminal.cwd,
        env: { TERM: "xterm-256color", PAGER: "cat", GIT_PAGER: "cat" },
        size: { cols: 100, rows: 30 },
      }, { timeoutMs: null });
      const tail = terminal.decoder.end();
      if (tail) this.append(terminal, tail);
      if (result.stdout) this.append(terminal, result.stdout);
      if (result.stderr) this.append(terminal, result.stderr);
      terminal.status = { kind: "exited", exitCode: result.exitCode, signal: null };
    } catch (error) {
      const tail = terminal.decoder.end();
      if (tail) this.append(terminal, tail);
      this.append(terminal, `\r\n[terminal error: ${error?.message ?? String(error)}]\r\n`);
      terminal.status = { kind: "exited", exitCode: null, signal: null };
    } finally {
      terminal.seq += 1;
      this.byProcess.delete(terminal.processId);
    }
  }

  handleNotification(message) {
    if (message.method !== "command/exec/outputDelta") return;
    const terminal = this.byProcess.get(message.params?.processId);
    if (!terminal || !message.params?.deltaBase64) return;
    const text = terminal.decoder.write(Buffer.from(message.params.deltaBase64, "base64"));
    if (text) this.append(terminal, text);
    if (message.params.capReached) terminal.truncated = true;
  }

  append(terminal, text) {
    terminal.text += text;
    terminal.seq += 1;
    const bytes = Buffer.byteLength(terminal.text);
    if (bytes <= MAX_SCROLLBACK_BYTES) return;
    const tail = Buffer.from(terminal.text).subarray(bytes - MAX_SCROLLBACK_BYTES).toString("utf8");
    terminal.text = tail.replace(/^\uFFFD/, "");
    terminal.truncated = true;
  }

  owned(request) {
    const terminal = this.terminals.get(request.terminalId);
    if (!terminal || terminal.sessionId !== request.sessionId) {
      return rejected("terminal-not-found", `terminal "${request.terminalId}" was not found`);
    }
    return success(terminal);
  }

  snapshot(terminal) {
    return {
      sessionId: terminal.terminalId,
      ...(terminal.name === undefined ? {} : { name: terminal.name }),
      type: terminal.type,
      status: terminal.status,
    };
  }

  failure(error) {
    return rejected("internal", error?.message ?? String(error));
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopNotifications();
    const running = [...this.terminals.values()].filter((terminal) => terminal.status.kind === "running");
    await Promise.allSettled(running.map((terminal) => this.terminal.request(
      "command/exec/terminate",
      { processId: terminal.processId },
    )));
    this.terminals.clear();
    this.byProcess.clear();
  }
}

function legacyTerminalCapability(client, ready) {
  return {
    whenReady: () => ready,
    request: client.request.bind(client),
    subscribeNotification(listener) {
      client.on("notification", listener);
      return () => client.off("notification", listener);
    },
  };
}
