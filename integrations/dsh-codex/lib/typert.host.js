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
const result = (value) => z.union([failure, z.object({
	ok: z.literal(true),
	value
})]);
const parameter = (name, schema, symbol) => ({
	name,
	wire: name,
	source: "json",
	codec: {
		mode: "strict",
		typeSymbol: `relay-dsh-codex#${symbol}`,
		schema
	}
});
const direct = (id, method, parameters, schema, symbol) => ({
	id: `relay-dsh-codex#${id}`,
	service: "relayWorkbenchTerminal",
	namespace: "relayWorkbenchTerminal",
	method,
	invocation: { kind: "direct" },
	parameters,
	result: {
		mode: "strict",
		typeSymbol: `relay-dsh-codex#${symbol}`,
		schema
	}
});
//#endregion
//#region typert.host.js
const TYPERT = {
	package: "@relay/dsh-codex",
	face: "host",
	schemas: [],
	invocations: [
		direct("terminal/list", "list", [parameter("request", z.object({ sessionId }), "SessionRequest")], result(z.array(snapshot)), "TerminalResult"),
		direct("terminal/spawn", "spawn", [parameter("request", z.object({
			sessionId,
			type: z.string().optional(),
			name: z.string().optional(),
			cwd: z.string().optional()
		}), "SpawnRequest")], result(snapshot.extend({ motd: z.string() })), "TerminalResult"),
		direct("terminal/readRaw", "readRaw", [parameter("request", z.object({
			sessionId,
			terminalId
		}), "TargetRequest")], result(z.object({
			text: z.string(),
			truncated: z.boolean(),
			seq: z.number()
		})), "TerminalResult"),
		direct("terminal/input", "input", [parameter("request", z.object({
			sessionId,
			terminalId,
			data: z.string()
		}), "InputRequest")], result(z.object({ accepted: z.literal(true) })), "TerminalResult"),
		direct("terminal/resize", "resize", [parameter("request", z.object({
			sessionId,
			terminalId,
			cols: z.number(),
			rows: z.number()
		}), "ResizeRequest")], result(z.object({ resized: z.literal(true) })), "TerminalResult")
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