import { z } from "zod";

const sessionId = z.string().min(1);
const monitorId = z.string().min(1);
const registrations = z.array(z.unknown());

const descriptors = [
  {
    id: "relay-dsh-plugin#relayManagement/list",
    service: "relayManagement",
    namespace: "relayManagement",
    method: "list",
    invocation: { kind: "direct" },
    parameters: [],
    result: {
      mode: "strict",
      typeSymbol: "relay-dsh-plugin#RelayManagementSnapshot",
      schema: z.object({ registrations }),
    },
  },
  {
    id: "relay-dsh-plugin#relayManagement/cancel",
    service: "relayManagement",
    namespace: "relayManagement",
    method: "cancel",
    invocation: { kind: "direct" },
    parameters: [{
      name: "sessionId",
      wire: "sessionId",
      source: "json",
      codec: {
        mode: "strict",
        typeSymbol: "relay-dsh-plugin#SessionId",
        schema: sessionId,
      },
    }],
    result: {
      mode: "strict",
      typeSymbol: "relay-dsh-plugin#RelayCancelResult",
      schema: z.object({ registration: z.unknown() }),
    },
  },
  {
    id: "relay-dsh-plugin#relayManagement/runNow",
    service: "relayManagement",
    namespace: "relayManagement",
    method: "runNow",
    invocation: { kind: "direct" },
    parameters: [{
      name: "monitorId",
      wire: "monitorId",
      source: "json",
      codec: {
        mode: "strict",
        typeSymbol: "relay-dsh-plugin#MonitorId",
        schema: monitorId,
      },
    }],
    result: {
      mode: "strict",
      typeSymbol: "relay-dsh-plugin#RelayRunNowResult",
      schema: z.object({ result: z.unknown(), registrations }),
    },
  },
];

export const TYPERT = {
  package: "relay-dsh-plugin",
  face: "host",
  schemas: [],
  invocations: descriptors,
  model: { services: [], events: [], objects: [] },
};
