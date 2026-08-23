import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export declare function acquireDshCoreClient(ctx: ClientContext): Promise<{
  readonly release: () => Promise<void>
}>
