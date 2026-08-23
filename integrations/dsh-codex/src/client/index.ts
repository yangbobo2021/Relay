import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@relay/dsh-core/client-types'
import { acquireDshCoreClient } from '@relay/dsh-core/client-api'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { CodexActivityView } from './CodexActivityView.tsx'
import { codexActivityDefinition } from './codex-activity.ts'
import { CODEX_REMOTE } from './remote.ts'
import { apply as applyWebTerminal, type WorkbenchTerminalWire } from './workbench/terminal/index.ts'

interface ConnectionFace { api: { sessions: Pick<IApiClient['sessions'], 'models' | 'selectModel'> } }
interface ModelGroup { readonly id: string; readonly models: readonly { readonly id: string; readonly reasoning?: { readonly defaultEffort?: string } }[] }

export const inject = ['slots', 'theme', 'locale', 'remote', 'sessions', 'connection', 'conversationEvents']

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const core = await acquireDshCoreClient(ctx)
  let unmount: (() => Promise<void>) | undefined
  try {
    unmount = await ctx.remote.$mount(CODEX_REMOTE as TypertRemoteContribution)
    const terminal = ctx.get('remote.relayWorkbenchTerminal' as never) as WorkbenchTerminalWire | undefined
    if (terminal !== undefined) applyWebTerminal(ctx, terminal)
    ctx.conversationEvents.register(codexActivityDefinition)
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
      name: 'conversation.chat.node', key: 'relay-codex-activity',
    }, CodexActivityView))
    const unsubscribe = installModelSelection(ctx, 'relay-codex', 'relay-codex', 'relay-claude')
    return async () => { unsubscribe(); await unmount?.(); await core.release() }
  } catch (error) {
    await unmount?.()
    await core.release()
    throw error
  }
}

function installModelSelection(ctx: ClientContext, preset: string, provider: string, otherProvider: string): () => void {
  const connection = ctx.get('connection' as never) as unknown as ConnectionFace
  const selecting = new Set<string>()
  const sync = (): void => {
    const list = ctx.sessions.list.getSnapshot()
    const id = list.current
    if (id === undefined || list.byId[id]?.blank !== true || selecting.has(id)) return
    const selectedPreset = list.byId[id]?.agentPreset
    if (selectedPreset !== preset && selectedPreset === otherProvider) return
    selecting.add(id)
    void connection.api.sessions.models({ sessionId: id }).then(async (response: Awaited<ReturnType<ConnectionFace['api']['sessions']['models']>>) => {
      const { result } = response
      if (!result.ok) return
      const target = selectedPreset === preset
        ? (result.value.groups as readonly ModelGroup[]).find(group => group.id === provider)
        : result.value.current.provider === provider
          ? (result.value.groups as readonly ModelGroup[]).find(group => group.id !== provider && group.id !== otherProvider)
          : undefined
      const model = target?.models[0]
      if (target && model) await connection.api.sessions.selectModel({ sessionId: id as SessionId, provider: target.id, model: model.id, ...(model.reasoning?.defaultEffort ? { reasoningEffort: model.reasoning.defaultEffort } : {}) })
    }).catch(() => {}).finally(() => { selecting.delete(id) })
  }
  const off = ctx.sessions.list.subscribe(sync); sync(); return off
}
