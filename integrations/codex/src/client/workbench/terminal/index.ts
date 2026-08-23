import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { TerminalOutputStore } from './store.ts'
import { WebTerminalPanel } from './WebTerminalPanel.tsx'
import type {
  TerminalRawReadResult,
  TerminalSessionSnapshot,
  TerminalSpawnResult,
  WebTerminalAccepted,
  WebTerminalInjected,
  WebTerminalResized,
  WebTerminalResult,
} from './types.ts'

export type { TerminalPanelState } from './store.ts'
export type { WebTerminalInjected, WebTerminalRemote } from './types.ts'

type NestedResult<T> = WebTerminalResult<WebTerminalResult<T>>

export interface WorkbenchTerminalWire {
  list: WebTerminalInjected['webTerminal']['list'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<readonly TerminalSessionSnapshot[]>>
    : never
  spawn: WebTerminalInjected['webTerminal']['spawn'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<TerminalSpawnResult>>
    : never
  readRaw: WebTerminalInjected['webTerminal']['readRaw'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<TerminalRawReadResult>>
    : never
  input: WebTerminalInjected['webTerminal']['input'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<WebTerminalAccepted>>
    : never
  resize: WebTerminalInjected['webTerminal']['resize'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<WebTerminalResized>>
    : never
}

function flatten<T>(result: NestedResult<T>): WebTerminalResult<T> {
  return result.ok ? result.value : result
}

export function apply(ctx: ClientContext, wire: WorkbenchTerminalWire): void {
  const store = new TerminalOutputStore()
  const webTerminal: WebTerminalInjected['webTerminal'] = {
    list: async request => flatten(await wire.list(request)),
    spawn: async request => flatten(await wire.spawn(request)),
    readRaw: async request => flatten(await wire.readRaw(request)),
    input: async request => flatten(await wire.input(request)),
    resize: async request => flatten(await wire.resize(request)),
  }
  ctx.slots.inject('workbench.bottom.terminal', () => ctx.slots.register({
    name: 'workbench.bottom.terminal',
    inject: (): WebTerminalInjected => ({
      webTerminal,
      store,
    }),
  }, WebTerminalPanel))
}
