import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from './core.ts'

const STATE = Symbol.for('relay.dsh.core.client.v1')

interface CoreClientState {
  consumers: number
  pending: Promise<() => Promise<void>>
}

export async function acquireDshCoreClient(ctx: ClientContext): Promise<{ readonly release: () => Promise<void> }> {
  const root = ((ctx as unknown as { root?: object }).root ?? ctx) as ClientContext & { [STATE]?: CoreClientState }
  let state = root[STATE]
  if (state === undefined) {
    state = { consumers: 0, pending: activateCoreClient(root) }
    Object.defineProperty(root, STATE, { value: state, configurable: true })
    try {
      await state.pending
    } catch (error) {
      delete root[STATE]
      throw error
    }
  } else {
    await state.pending
  }
  state.consumers += 1
  let released = false
  return {
    async release(): Promise<void> {
      if (released) return
      released = true
      state.consumers -= 1
      if (state.consumers !== 0) return
      delete root[STATE]
      const dispose = await state.pending
      await dispose()
    },
  }
}

async function activateCoreClient(root: ClientContext): Promise<() => Promise<void>> {
  const fiber = root.plugin({ name: 'Relay DSH Core client', inject: [...inject], apply })
  await fiber
  return async () => { await fiber.dispose() }
}
