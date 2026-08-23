import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { AdvancedDebugPreference } from '../../advanced-debug-preference.mjs'
import {
  AdvancedDebugGuard,
  AdvancedDebugSection,
  HiddenSessionLogAction,
  type AdvancedDebugInjected,
} from './AdvancedDebug.tsx'
import { WaitingEventsSection, type ManagementSnapshot, type WaitingEventsInjected } from './WaitingEventsSection.tsx'
import { en, zh, type RelayManagementLocaleKey } from './locales.ts'
import { RELAY_REMOTE } from './remote.ts'
import { apply as applyWorkbenchLayout } from './workbench/layout/index.ts'
import { apply as applyFileExplorer, type WorkspaceFilesWire } from './workbench/files/index.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'relay.management': RelayManagementLocaleKey
  }
}

interface RemoteResult<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string }
}

interface RelayManagementRemote {
  list(): Promise<RemoteResult<ManagementSnapshot>>
  cancel(sessionId: string): Promise<RemoteResult<unknown>>
  runNow(monitorId: string): Promise<RemoteResult<unknown>>
}

export const inject = ['slots', 'theme', 'locale', 'remote', 'sessions']

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  applyWorkbenchLayout(ctx)
  const unmount = await ctx.remote.$mount(RELAY_REMOTE as TypertRemoteContribution)
  const remote = ctx.get('remote.relayManagement' as never) as RelayManagementRemote | undefined
  const workspaceFiles = ctx.get('remote.relayWorkspaceFiles' as never) as WorkspaceFilesWire | undefined
  if (workspaceFiles === undefined) {
    await unmount()
    throw new Error('Relay workspace Remote capability did not mount')
  }
  applyFileExplorer(ctx, workspaceFiles)

  ctx.effect(() => ctx.locale.register('relay.management', { zh, en }), 'relay-management: dictionaries')
  const t = ctx.locale.bind('relay.management') as WaitingEventsInjected['t']
  if (remote !== undefined) {
    const unwrap = <T>(result: RemoteResult<T>): T => {
      if (result.ok && result.value !== undefined) return result.value
      throw new Error(result.error?.message ?? 'Relay management request failed')
    }
    const injected = (): WaitingEventsInjected => ({
      list: async () => unwrap(await remote.list()),
      cancel: async (sessionId) => { unwrap(await remote.cancel(sessionId)) },
      runNow: async (monitorId) => { unwrap(await remote.runNow(monitorId)) },
      openSession: (sessionId) => { ctx.sessions.open(sessionId as SessionId) },
      t,
    })
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'relay-waits',
      order: 20,
      label: () => t('nav'),
      locale: 'relay.management',
      inject: injected,
    }, WaitingEventsSection))
  }

  const advancedDebug = new AdvancedDebugPreference()
  const advancedDebugHooks: Pick<AdvancedDebugInjected, 'hooks'> = {
    hooks: { advancedDebug },
  }

  ctx.effect(() => () => { advancedDebug.dispose() }, 'relay-management: advanced debug preference')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'relay-advanced-debug',
    order: 90,
    label: () => t('advancedNav'),
    locale: 'relay.management',
    inject: (): AdvancedDebugInjected => ({
      ...advancedDebugHooks,
      setAdvancedDebug: enabled => { advancedDebug.set(enabled) },
    }),
  }, AdvancedDebugSection))

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'relay-advanced-debug-guard',
    order: -20,
    inject: () => advancedDebugHooks,
  }, AdvancedDebugGuard))

  ctx.slots.inject('conversation.session.header.utilities', () => {
    let removeShadow: (() => void) | undefined
    const reconcile = (): void => {
      if (advancedDebug.getSnapshot()) {
        removeShadow?.()
        removeShadow = undefined
      } else if (removeShadow === undefined) {
        removeShadow = ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'session-log-download',
          priority: -100,
        }, HiddenSessionLogAction)
      }
    }
    const unsubscribe = advancedDebug.subscribe(reconcile)
    reconcile()
    return () => {
      unsubscribe()
      removeShadow?.()
    }
  })

  return async () => {
    await unmount()
  }
}
