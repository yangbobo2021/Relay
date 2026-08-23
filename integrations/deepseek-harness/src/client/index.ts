import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { WaitingEventsSection, type ManagementSnapshot, type WaitingEventsInjected } from './WaitingEventsSection.tsx'
import { en, zh, type RelayManagementLocaleKey } from './locales.ts'
import { RELAY_REMOTE } from './remote.ts'

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

export const inject = ['slots', 'locale', 'remote', 'sessions']

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(RELAY_REMOTE as TypertRemoteContribution)
  const remote = ctx.get('remote.relayManagement' as never) as RelayManagementRemote | undefined
  if (remote === undefined) {
    await unmount()
    throw new Error('Relay Events management Remote capability did not mount')
  }
  ctx.effect(() => ctx.locale.register('relay.management', { zh, en }), 'relay-events: dictionaries')
  const t = ctx.locale.bind('relay.management') as WaitingEventsInjected['t']
  const unwrap = <T>(result: RemoteResult<T>): T => {
    if (result.ok && result.value !== undefined) return result.value
    throw new Error(result.error?.message ?? 'Relay Events management request failed')
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
  return unmount
}
