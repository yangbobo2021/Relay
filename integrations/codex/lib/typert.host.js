import { z } from "zod";
//#region remote-schema.js
const sessionId = z.string().min(1);
const terminalId = z.string().min(1);
const failure = z.object({
	ok: z.literal(false),
	error: z.object({
		code: z.string(),
		message: z.string()
	})
});
const result = (value) => z.union([failure, z.object({
	ok: z.literal(true),
	value
})]);
const status = z.union([z.object({ kind: z.literal("running") }), z.object({
	kind: z.literal("exited"),
	exitCode: z.number().nullable(),
	signal: z.string().nullable()
})]);
const snapshot = z.object({
	sessionId: terminalId,
	name: z.string().optional(),
	type: z.string(),
	status
});
const workspaceEntry = z.object({
	name: z.string(),
	path: z.string(),
	type: z.enum([
		"file",
		"directory",
		"other"
	]),
	size: z.number().optional(),
	version: z.string().optional()
});
const workspaceListing = z.object({
	root: z.string(),
	path: z.string(),
	entries: z.array(workspaceEntry)
});
const workspacePreview = z.object({
	path: z.string(),
	content: z.string(),
	truncated: z.boolean(),
	size: z.number().optional(),
	version: z.string().optional()
});
const parameter = (name, schema, symbol) => ({
	name,
	wire: name,
	source: "json",
	codec: {
		mode: "strict",
		typeSymbol: `relay-plugin-codex#${symbol}`,
		schema
	}
});
const direct = (id, service, method, parameters, schema, symbol, options = {}) => ({
	id: `relay-plugin-codex#${id}`,
	service,
	namespace: service,
	method,
	invocation: { kind: "direct" },
	parameters,
	...options.cancellation ? { cancellation: { parameter: "signal" } } : {},
	result: {
		mode: "strict",
		typeSymbol: `relay-plugin-codex#${symbol}`,
		schema
	}
});
//#endregion
//#region typert.host.js
const TYPERT = {
	package: "@relay/plugin-codex",
	face: "host",
	schemas: [],
	invocations: [
		direct("terminal/list", "relayWorkbenchTerminal", "list", [parameter("request", z.object({ sessionId }), "SessionRequest")], result(z.array(snapshot)), "TerminalResult"),
		direct("terminal/spawn", "relayWorkbenchTerminal", "spawn", [parameter("request", z.object({
			sessionId,
			type: z.string().optional(),
			name: z.string().optional(),
			cwd: z.string().optional()
		}), "SpawnRequest")], result(snapshot.extend({ motd: z.string() })), "TerminalResult"),
		direct("terminal/readRaw", "relayWorkbenchTerminal", "readRaw", [parameter("request", z.object({
			sessionId,
			terminalId
		}), "TargetRequest")], result(z.object({
			text: z.string(),
			truncated: z.boolean(),
			seq: z.number()
		})), "TerminalResult"),
		direct("terminal/input", "relayWorkbenchTerminal", "input", [parameter("request", z.object({
			sessionId,
			terminalId,
			data: z.string()
		}), "InputRequest")], result(z.object({ accepted: z.literal(true) })), "TerminalResult"),
		direct("terminal/resize", "relayWorkbenchTerminal", "resize", [parameter("request", z.object({
			sessionId,
			terminalId,
			cols: z.number(),
			rows: z.number()
		}), "ResizeRequest")], result(z.object({ resized: z.literal(true) })), "TerminalResult"),
		direct("workspace/list", "relayWorkspaceFiles", "list", [parameter("request", z.object({
			sessionId,
			path: z.string().optional()
		}), "WorkspaceFileRequest")], result(workspaceListing), "WorkspaceFileResult", { cancellation: true }),
		direct("workspace/readText", "relayWorkspaceFiles", "readText", [parameter("request", z.object({
			sessionId,
			path: z.string()
		}), "WorkspaceFileReadRequest")], result(workspacePreview), "WorkspaceFileResult", { cancellation: true })
	],
	model: {
		services: [],
		events: [],
		objects: []
	}
};
//#endregion
export { TYPERT };

//# sourceMappingURL=typert.host.js.map