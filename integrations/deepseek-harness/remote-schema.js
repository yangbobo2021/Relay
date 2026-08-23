import { z } from "zod";

const sessionId = z.string().min(1);
const monitorId = z.string().min(1);
const registrations = z.array(z.unknown());
const direct = (id, service, method, parameters, result, typeSymbol) => ({
  id: `relay-plugin-events#${id}`,
  service,
  namespace: service,
  method,
  invocation: { kind: "direct" },
  parameters,
  result: { mode: "strict", typeSymbol: `relay-plugin-events#${typeSymbol}`, schema: result },
});
const jsonParameter = (name, schema, typeSymbol) => ({
  name,
  wire: name,
  source: "json",
  codec: { mode: "strict", typeSymbol: `relay-plugin-events#${typeSymbol}`, schema },
});

export const RELAY_DESCRIPTORS = [
  direct("relayManagement/list", "relayManagement", "list", [],
    z.object({ registrations }), "RelayManagementSnapshot"),
  direct("relayManagement/cancel", "relayManagement", "cancel", [
    jsonParameter("sessionId", sessionId, "SessionId"),
  ], z.object({ registration: z.unknown() }), "RelayCancelResult"),
  direct("relayManagement/runNow", "relayManagement", "runNow", [
    jsonParameter("monitorId", monitorId, "MonitorId"),
  ], z.object({ result: z.unknown(), registrations }), "RelayRunNowResult"),
];
