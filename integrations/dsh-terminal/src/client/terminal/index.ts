import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { IconCodeOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { IWorkbench } from '@relay/dsh-plugin-contracts'
import { TERMINAL_REMOTE } from '../remote.ts'
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
    ? (request: Request) => Promise<NestedResult<readonly TerminalSessionSnapshot[]>> : never
  spawn: WebTerminalInjected['webTerminal']['spawn'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<TerminalSpawnResult>> : never
  readRaw: WebTerminalInjected['webTerminal']['readRaw'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<TerminalRawReadResult>> : never
  input: WebTerminalInjected['webTerminal']['input'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<WebTerminalAccepted>> : never
  resize: WebTerminalInjected['webTerminal']['resize'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<WebTerminalResized>> : never
}

function flatten<T>(result: NestedResult<T>): WebTerminalResult<T> {
  return result.ok ? result.value : result
}

export const inject = ['slots', 'remote', 'workbench']

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(TERMINAL_REMOTE as TypertRemoteContribution)
  try {
    const wire = ctx.get('remote.relayWorkbenchTerminal' as never) as WorkbenchTerminalWire | undefined
    if (wire === undefined) throw new Error('Terminal Remote capability did not mount')
    const workbench = ctx.get('workbench' as never) as unknown as IWorkbench
    const store = new TerminalOutputStore()
    const webTerminal: WebTerminalInjected['webTerminal'] = {
      list: async request => flatten(await wire.list(request)),
      spawn: async request => flatten(await wire.spawn(request)),
      readRaw: async request => flatten(await wire.readRaw(request)),
      input: async request => flatten(await wire.input(request)),
      resize: async request => flatten(await wire.resize(request)),
    }
    const disposeView = workbench.registerView({
      id: 'terminal', region: 'bottom', title: 'Terminal', order: 10, icon: IconCodeOutline16,
    })
    const disposeSlot = ctx.slots.register({
      name: 'workbench.bottom.view', key: 'terminal',
      inject: (): WebTerminalInjected => ({ webTerminal, store }),
    }, WebTerminalPanel)
    return async () => {
      disposeSlot()
      disposeView()
      await unmount()
    }
  } catch (error) {
    await unmount()
    throw error
  }
}
