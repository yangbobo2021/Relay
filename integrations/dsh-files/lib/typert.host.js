import { z } from "zod";
//#region remote-schema.js
const sessionId = z.string().min(1);
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
const entry = z.object({
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
const listing = z.object({
	root: z.string(),
	path: z.string(),
	entries: z.array(entry)
});
const preview = z.object({
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
		typeSymbol: `relay-dsh-plugin-files#${symbol}`,
		schema
	}
});
const direct = (id, method, parameters, schema, symbol) => ({
	id: `relay-dsh-plugin-files#${id}`,
	service: "relayWorkspaceFiles",
	namespace: "relayWorkspaceFiles",
	method,
	invocation: { kind: "direct" },
	parameters,
	cancellation: { parameter: "signal" },
	result: {
		mode: "strict",
		typeSymbol: `relay-dsh-plugin-files#${symbol}`,
		schema
	}
});
//#endregion
//#region typert.host.js
const TYPERT = {
	package: "@relay/dsh-plugin-files",
	face: "host",
	schemas: [],
	invocations: [direct("workspace/list", "list", [parameter("request", z.object({
		sessionId,
		path: z.string().optional()
	}), "WorkspaceFileRequest")], result(listing), "WorkspaceFileResult"), direct("workspace/readText", "readText", [parameter("request", z.object({
		sessionId,
		path: z.string()
	}), "WorkspaceFileReadRequest")], result(preview), "WorkspaceFileResult")],
	model: {
		services: [],
		events: [],
		objects: []
	}
};
//#endregion
export { TYPERT };

//# sourceMappingURL=typert.host.js.map