import { Service } from "@deepseek-ai/cordis";
import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region provider-registry.js
var RelayTerminalProviderRegistry = class extends Service {
	apiVersion = 1;
	#providers = /* @__PURE__ */ new Map();
	constructor(ctx) {
		super(ctx, "relayTerminalProviders");
	}
	register(provider) {
		validateProvider(provider);
		if (this.#providers.has(provider.id)) throw new Error(`terminal provider ${provider.id} is already registered`);
		const dispose = this.ctx.effect(() => {
			this.#providers.set(provider.id, provider);
			return () => {
				if (this.#providers.get(provider.id) === provider) this.#providers.delete(provider.id);
			};
		}, "relayTerminalProviders.register()");
		return () => void dispose();
	}
	list() {
		return [...this.#providers.values()];
	}
	get(providerId) {
		return this.#providers.get(providerId);
	}
};
function validateProvider(provider) {
	if (!provider || typeof provider !== "object") throw new Error("terminal provider is required");
	if (!provider.id || !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(provider.id)) throw new Error("terminal provider id must be lowercase and stable");
	if (!provider.title?.trim()) throw new Error("terminal provider title must be non-empty");
	for (const method of [
		"whenReady",
		"request",
		"subscribeNotification"
	]) if (typeof provider[method] !== "function") throw new Error(`terminal provider ${provider.id} must implement ${method}()`);
}
//#endregion
//#region terminal-gateway.js
const MAX_SCROLLBACK_BYTES = 2 * 1024 * 1024;
const success = (value) => ({
	ok: true,
	value
});
const rejected = (code, message) => ({
	ok: false,
	error: {
		code,
		message
	}
});
function shellCommand() {
	if (process.platform === "win32") return [process.env.ComSpec || "powershell.exe"];
	return [process.env.SHELL || "/bin/zsh", "-l"];
}
var RelayTerminalGateway = class extends TypertRemoteService {
	constructor(ctx, { providers, resolveAgent }) {
		super(ctx, "relayWorkbenchTerminal");
		this.providers = providers;
		this.resolveAgent = resolveAgent;
		this.terminals = /* @__PURE__ */ new Map();
		this.byProcess = /* @__PURE__ */ new Map();
		this.subscriptions = /* @__PURE__ */ new Map();
		this.disposed = false;
		ctx.effect(() => () => this.dispose(), "relay workbench terminals");
	}
	async list(request) {
		return success([...this.terminals.values()].filter((terminal) => terminal.ownerSessionId === request.sessionId).sort((left, right) => left.createdAt - right.createdAt).map((terminal) => this.snapshot(terminal)));
	}
	async spawn(request) {
		try {
			const provider = request.type ? this.providers.get(request.type) : this.providers.list()[0];
			if (!provider) return rejected("provider-unavailable", "no interactive terminal provider is installed");
			await provider.whenReady();
			this.ensureSubscription(provider);
			const agent = await this.resolveAgent(request.sessionId);
			const cwd = request.cwd ?? agent.session.header.cwd;
			if (!cwd) return rejected("workspace-unavailable", `session "${request.sessionId}" has no workspace cwd`);
			const terminalId = randomUUID();
			const processId = `relay-terminal-${terminalId}`;
			const terminal = {
				terminalId,
				processId,
				provider,
				ownerSessionId: request.sessionId,
				name: request.name,
				cwd,
				createdAt: Date.now(),
				status: { kind: "running" },
				decoder: new StringDecoder("utf8"),
				text: "",
				seq: 0,
				truncated: false
			};
			this.terminals.set(terminalId, terminal);
			this.byProcess.set(`${provider.id}:${processId}`, terminal);
			this.run(terminal);
			return success({
				...this.snapshot(terminal),
				motd: ""
			});
		} catch (error) {
			return this.failure(error);
		}
	}
	async readRaw(request) {
		const terminal = this.owned(request);
		if (!terminal.ok) return terminal;
		return success({
			text: terminal.value.text,
			truncated: terminal.value.truncated,
			seq: terminal.value.seq
		});
	}
	async input(request) {
		const terminal = this.owned(request);
		if (!terminal.ok) return terminal;
		if (terminal.value.status.kind !== "running") return rejected("terminal-exited", "terminal has exited");
		try {
			await terminal.value.provider.request("command/exec/write", {
				processId: terminal.value.processId,
				deltaBase64: Buffer.from(request.data).toString("base64"),
				closeStdin: false
			});
			return success({ accepted: true });
		} catch (error) {
			return this.failure(error);
		}
	}
	async resize(request) {
		const terminal = this.owned(request);
		if (!terminal.ok) return terminal;
		if (!Number.isSafeInteger(request.cols) || request.cols <= 0 || !Number.isSafeInteger(request.rows) || request.rows <= 0) return rejected("invalid-size", "terminal rows and cols must be positive integers");
		if (terminal.value.status.kind !== "running") return rejected("terminal-exited", "terminal has exited");
		try {
			await terminal.value.provider.request("command/exec/resize", {
				processId: terminal.value.processId,
				size: {
					cols: request.cols,
					rows: request.rows
				}
			});
			return success({ resized: true });
		} catch (error) {
			return this.failure(error);
		}
	}
	async run(terminal) {
		try {
			const result = await terminal.provider.request("command/exec", {
				command: shellCommand(),
				processId: terminal.processId,
				tty: true,
				streamStdin: true,
				streamStdoutStderr: true,
				disableOutputCap: true,
				disableTimeout: true,
				cwd: terminal.cwd,
				env: {
					TERM: "xterm-256color",
					PAGER: "cat",
					GIT_PAGER: "cat"
				},
				size: {
					cols: 100,
					rows: 30
				}
			}, { timeoutMs: null });
			const tail = terminal.decoder.end();
			if (tail) this.append(terminal, tail);
			if (result.stdout) this.append(terminal, result.stdout);
			if (result.stderr) this.append(terminal, result.stderr);
			terminal.status = {
				kind: "exited",
				exitCode: result.exitCode,
				signal: null
			};
		} catch (error) {
			const tail = terminal.decoder.end();
			if (tail) this.append(terminal, tail);
			this.append(terminal, `\r\n[terminal error: ${error?.message ?? String(error)}]\r\n`);
			terminal.status = {
				kind: "exited",
				exitCode: null,
				signal: null
			};
		} finally {
			terminal.seq += 1;
			this.byProcess.delete(`${terminal.provider.id}:${terminal.processId}`);
		}
	}
	ensureSubscription(provider) {
		if (this.subscriptions.has(provider.id)) return;
		this.subscriptions.set(provider.id, provider.subscribeNotification((message) => this.handleNotification(provider.id, message)));
	}
	handleNotification(providerId, message) {
		if (message.method !== "command/exec/outputDelta") return;
		const terminal = this.byProcess.get(`${providerId}:${message.params?.processId}`);
		if (!terminal || !message.params?.deltaBase64) return;
		const output = terminal.decoder.write(Buffer.from(message.params.deltaBase64, "base64"));
		if (output) this.append(terminal, output);
		if (message.params.capReached) terminal.truncated = true;
	}
	append(terminal, output) {
		terminal.text += output;
		terminal.seq += 1;
		const bytes = Buffer.byteLength(terminal.text);
		if (bytes <= MAX_SCROLLBACK_BYTES) return;
		terminal.text = Buffer.from(terminal.text).subarray(bytes - MAX_SCROLLBACK_BYTES).toString("utf8").replace(/^\uFFFD/, "");
		terminal.truncated = true;
	}
	owned(request) {
		const terminal = this.terminals.get(request.terminalId);
		if (!terminal || terminal.ownerSessionId !== request.sessionId) return rejected("terminal-not-found", `terminal "${request.terminalId}" was not found`);
		return success(terminal);
	}
	snapshot(terminal) {
		return {
			sessionId: terminal.terminalId,
			...terminal.name === void 0 ? {} : { name: terminal.name },
			type: terminal.provider.id,
			status: terminal.status
		};
	}
	failure(error) {
		return rejected("internal", error?.message ?? String(error));
	}
	async dispose() {
		if (this.disposed) return;
		this.disposed = true;
		for (const stop of this.subscriptions.values()) stop();
		this.subscriptions.clear();
		const running = [...this.terminals.values()].filter((terminal) => terminal.status.kind === "running");
		await Promise.allSettled(running.map((terminal) => terminal.provider.request("command/exec/terminate", { processId: terminal.processId })));
		this.terminals.clear();
		this.byProcess.clear();
	}
};
//#endregion
//#region host-plugin.js
const name = "relay-dsh-plugin-terminal";
const inject = ["agents", "typert"];
async function apply(ctx) {
	const resolveAgent = async (sessionId) => {
		const lookup = ctx.typert.lookups.get("agent");
		if (!lookup) throw new Error("Terminal requires DSH's configured shared Agent lookup");
		const agent = await lookup.resolve(sessionId);
		if (!agent) throw new Error(`session ${sessionId} was not found`);
		return agent;
	};
	const registry = new RelayTerminalProviderRegistry(ctx);
	const fiber = ctx.plugin({
		name: "relay terminal remote",
		apply(scope) {
			new RelayTerminalGateway(scope, {
				providers: registry,
				resolveAgent
			});
		}
	});
	ctx.effect(() => () => fiber.dispose(), "relay terminal remote");
	await fiber;
}
//#endregion
export { apply, inject, name };

//# sourceMappingURL=host-plugin.js.map