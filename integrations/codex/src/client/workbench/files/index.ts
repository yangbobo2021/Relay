import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { FileExplorer } from './FileExplorer.tsx'
import { FileMenuItem, FileTabs } from './FileExplorerTabs.tsx'
import { FileExplorerStore } from './store.ts'
import type {
  FileExplorerInjected,
  WorkspaceFileListing,
  WorkspaceFileResult,
  WorkspaceFileTextPreview,
} from './types.ts'

export type { FileExplorerInjected, WorkspaceFilesRemote } from './types.ts'

type NestedResult<T> = WorkspaceFileResult<WorkspaceFileResult<T>>

export interface WorkspaceFilesWire {
  list: FileExplorerInjected['workspaceFiles']['list'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<WorkspaceFileListing>>
    : never
  readText: FileExplorerInjected['workspaceFiles']['readText'] extends (request: infer Request) => unknown
    ? (request: Request) => Promise<NestedResult<WorkspaceFileTextPreview>>
    : never
}

function flatten<T>(result: NestedResult<T>): WorkspaceFileResult<T> {
  return result.ok ? result.value : result
}

export function apply(ctx: ClientContext, wire: WorkspaceFilesWire): void {
  const store = new FileExplorerStore()
  const workspaceFiles: FileExplorerInjected['workspaceFiles'] = {
    list: async request => flatten(await wire.list(request)),
    readText: async request => flatten(await wire.readText(request)),
  }

  const injectStore = (): Pick<FileExplorerInjected, 'store'> => ({ store })
  ctx.slots.inject('workbench.side.tabs', () => ctx.slots.register({
    name: 'workbench.side.tabs',
    id: 'files',
    inject: injectStore,
  }, FileTabs))
  ctx.slots.inject('workbench.side.menu', () => ctx.slots.register({
    name: 'workbench.side.menu',
    id: 'files',
  }, FileMenuItem))
  ctx.slots.inject('workbench.side.view', () => ctx.slots.register({
    name: 'workbench.side.view',
    key: 'files',
    inject: (): FileExplorerInjected => ({ workspaceFiles, store }),
  }, FileExplorer))
}
