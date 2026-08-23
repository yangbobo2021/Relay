import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { IconFolderOpenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { IWorkbench } from '@relay/dsh-plugin-contracts'
import { FILES_REMOTE } from '../remote.ts'
import { FileExplorer } from './FileExplorer.tsx'
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

export const inject = ['slots', 'remote', 'workbench']

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(FILES_REMOTE as TypertRemoteContribution)
  try {
    const wire = ctx.get('remote.relayWorkspaceFiles' as never) as WorkspaceFilesWire | undefined
    if (wire === undefined) throw new Error('Files Remote capability did not mount')
    const workbench = ctx.get('workbench' as never) as unknown as IWorkbench
    const store = new FileExplorerStore()
    const workspaceFiles: FileExplorerInjected['workspaceFiles'] = {
      list: async request => flatten(await wire.list(request)),
      readText: async request => flatten(await wire.readText(request)),
    }
    const disposeView = workbench.registerView({
      id: 'files', region: 'side', title: 'Files', order: 10, icon: IconFolderOpenOutline16,
    })
    const disposeSlot = ctx.slots.register({
      name: 'workbench.side.view',
      key: 'files',
      inject: (): FileExplorerInjected => ({ workspaceFiles, store }),
    }, FileExplorer)
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
