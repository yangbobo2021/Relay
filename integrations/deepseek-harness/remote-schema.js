import { z } from "zod";

const sessionId = z.string().min(1);
const monitorId = z.string().min(1);
const registrations = z.array(z.unknown());

const workspaceFailure = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum([
      "workspace-unavailable",
      "path-outside-workspace",
      "not-found",
      "not-a-directory",
      "not-a-file",
      "not-text",
      "internal",
    ]),
    message: z.string(),
  }),
});
const workspaceEntry = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory", "other"]),
  size: z.number().optional(),
  version: z.string().optional(),
});
const workspaceListing = z.object({
  root: z.string(),
  path: z.string(),
  entries: z.array(workspaceEntry),
});
const workspacePreview = z.object({
  path: z.string(),
  content: z.string(),
  truncated: z.boolean(),
  size: z.number().optional(),
  version: z.string().optional(),
});

const direct = (id, service, method, parameters, result, typeSymbol, options = {}) => ({
  id: `relay-dsh-core#${id}`,
  service,
  namespace: service,
  method,
  invocation: { kind: "direct" },
  parameters,
  ...(options.cancellation ? { cancellation: { parameter: "signal" } } : {}),
  result: {
    mode: "strict",
    typeSymbol: `relay-dsh-core#${typeSymbol}`,
    schema: result,
  },
});

const jsonParameter = (name, schema, typeSymbol) => ({
  name,
  wire: name,
  source: "json",
  codec: {
    mode: "strict",
    typeSymbol: `relay-dsh-core#${typeSymbol}`,
    schema,
  },
});

const workspaceResult = (value) => z.union([
  workspaceFailure,
  z.object({ ok: z.literal(true), value }),
]);

export const RELAY_DESCRIPTORS = [
  direct("relayManagement/list", "relayManagement", "list", [],
    z.object({ registrations }), "RelayManagementSnapshot"),
  direct("relayManagement/cancel", "relayManagement", "cancel", [
    jsonParameter("sessionId", sessionId, "SessionId"),
  ], z.object({ registration: z.unknown() }), "RelayCancelResult"),
  direct("relayManagement/runNow", "relayManagement", "runNow", [
    jsonParameter("monitorId", monitorId, "MonitorId"),
  ], z.object({ result: z.unknown(), registrations }), "RelayRunNowResult"),

  direct("relayWorkspaceFiles/list", "relayWorkspaceFiles", "list", [
    jsonParameter("request", z.object({ sessionId, path: z.string().optional() }), "WorkspaceFileRequest"),
  ], workspaceResult(workspaceListing), "WorkspaceFileResult", { cancellation: true }),
  direct("relayWorkspaceFiles/readText", "relayWorkspaceFiles", "readText", [
    jsonParameter("request", z.object({ sessionId, path: z.string() }), "WorkspaceFileReadRequest"),
  ], workspaceResult(workspacePreview), "WorkspaceFileResult", { cancellation: true }),
];
