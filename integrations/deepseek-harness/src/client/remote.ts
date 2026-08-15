import { z } from 'zod'

const sessionId = z.string().min(1)
const monitorId = z.string().min(1)
const registrations = z.array(z.unknown())

export const RELAY_REMOTE = {
  package: 'relay-dsh-plugin',
  descriptors: [
    {
      id: 'relay-dsh-plugin#relayManagement/list',
      service: 'relayManagement',
      namespace: 'relayManagement',
      method: 'list',
      invocation: { kind: 'direct' as const },
      parameters: [],
      result: {
        mode: 'strict' as const,
        typeSymbol: 'relay-dsh-plugin#RelayManagementSnapshot',
        schema: z.object({ registrations }),
      },
    },
    {
      id: 'relay-dsh-plugin#relayManagement/cancel',
      service: 'relayManagement',
      namespace: 'relayManagement',
      method: 'cancel',
      invocation: { kind: 'direct' as const },
      parameters: [{
        name: 'sessionId',
        wire: 'sessionId',
        source: 'json' as const,
        codec: {
          mode: 'strict' as const,
          typeSymbol: 'relay-dsh-plugin#SessionId',
          schema: sessionId,
        },
      }],
      result: {
        mode: 'strict' as const,
        typeSymbol: 'relay-dsh-plugin#RelayCancelResult',
        schema: z.object({ registration: z.unknown() }),
      },
    },
    {
      id: 'relay-dsh-plugin#relayManagement/runNow',
      service: 'relayManagement',
      namespace: 'relayManagement',
      method: 'runNow',
      invocation: { kind: 'direct' as const },
      parameters: [{
        name: 'monitorId',
        wire: 'monitorId',
        source: 'json' as const,
        codec: {
          mode: 'strict' as const,
          typeSymbol: 'relay-dsh-plugin#MonitorId',
          schema: monitorId,
        },
      }],
      result: {
        mode: 'strict' as const,
        typeSymbol: 'relay-dsh-plugin#RelayRunNowResult',
        schema: z.object({ result: z.unknown(), registrations }),
      },
    },
  ],
}
