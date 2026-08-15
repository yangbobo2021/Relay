import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
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
import { CodexActivityView } from './CodexActivityView.tsx'
import { codexActivityDefinition } from './codex-activity.ts'
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

interface ConnectionFace {
  api: { sessions: Pick<IApiClient['sessions'], 'models' | 'selectModel'> }
}

export const inject = ['slots', 'locale', 'remote', 'sessions', 'connection', 'conversationEvents']

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(RELAY_REMOTE as TypertRemoteContribution)
  const remote = ctx.get('remote.relayManagement' as never) as RelayManagementRemote | undefined
  const connection = ctx.get('connection' as never) as ConnectionFace
  if (remote === undefined) {
    await unmount()
    throw new Error('Relay management Remote did not mount')
  }

  ctx.conversationEvents.register(codexActivityDefinition)
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'relay-codex-activity',
  }, CodexActivityView))

  ctx.effect(() => ctx.locale.register('relay.management', { zh, en }), 'relay-management: dictionaries')
  const t = ctx.locale.bind('relay.management') as WaitingEventsInjected['t']
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

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'relay-waits',
    order: 20,
    label: () => t('nav'),
    locale: 'relay.management',
    inject: injected,
  }, WaitingEventsSection))

  const selecting = new Set<string>()
  const ensurePresetModel = async (sessionId: SessionId, codex: boolean): Promise<void> => {
    if (selecting.has(sessionId)) return
    selecting.add(sessionId)
    try {
      const { result } = await connection.api.sessions.models({ sessionId })
      if (!result.ok) return
      const currentIsCodex = result.value.current.provider === 'relay-codex'
      if (currentIsCodex === codex) return
      const group = result.value.groups.find(candidate => codex
        ? candidate.id === 'relay-codex'
        : candidate.id !== 'relay-codex')
      const model = group?.models[0]
      if (model === undefined) return
      await connection.api.sessions.selectModel({
        sessionId,
        provider: group.id,
        model: model.id,
        ...(model.reasoning?.defaultEffort === undefined
          ? {}
          : { reasoningEffort: model.reasoning.defaultEffort }),
      })
    } finally {
      selecting.delete(sessionId)
    }
  }
  const syncCodexModel = (): void => {
    const list = ctx.sessions.list.getSnapshot()
    const sessionId = list.current
    if (sessionId === undefined) return
    const summary = list.byId[sessionId]
    if (summary?.blank !== true) return
    void ensurePresetModel(sessionId, summary.agentPreset === 'relay-codex').catch(() => {})
  }
  const unsubscribe = ctx.sessions.list.subscribe(syncCodexModel)
  syncCodexModel()

  return async () => {
    unsubscribe()
    await unmount()
  }
}
