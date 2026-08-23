import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { acquireDshCoreClient } from './api.ts'

export { inject } from './core.ts'

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const ownership = await acquireDshCoreClient(ctx)
  return ownership.release
}
