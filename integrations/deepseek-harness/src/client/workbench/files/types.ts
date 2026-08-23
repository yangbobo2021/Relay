import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  WorkbenchPanelOwnerProps,
  WorkbenchSideMenuOwnerProps,
  WorkbenchSideTabsOwnerProps,
} from '../layout/index.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileExplorerStore } from './store.ts'

export interface WorkspaceFileRequest {
  readonly sessionId: SessionId
  readonly path?: string
}

export interface WorkspaceFileReadRequest {
  readonly sessionId: SessionId
  readonly path: string
}

export interface WorkspaceFileEntry {
  readonly name: string
  readonly path: string
  readonly type: 'file' | 'directory' | 'other'
  readonly size?: number
  readonly version?: string
}

export interface WorkspaceFileListing {
  readonly root: string
  readonly path: string
  readonly entries: readonly WorkspaceFileEntry[]
}

export interface WorkspaceFileTextPreview {
  readonly path: string
  readonly content: string
  readonly truncated: boolean
  readonly size?: number
  readonly version?: string
}

export type WorkspaceFileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

export interface WorkspaceFilesRemote {
  list(request: WorkspaceFileRequest): Promise<WorkspaceFileResult<WorkspaceFileListing>>
  readText(request: WorkspaceFileReadRequest): Promise<WorkspaceFileResult<WorkspaceFileTextPreview>>
}

export interface FileExplorerInjected {
  readonly workspaceFiles: WorkspaceFilesRemote
  readonly store: FileExplorerStore
}

export type FileExplorerProps =
  GlobalStandardProps
  & WorkbenchPanelOwnerProps
  & FileExplorerInjected

export type FileTabsProps =
  GlobalStandardProps
  & WorkbenchSideTabsOwnerProps
  & Pick<FileExplorerInjected, 'store'>

export type FileMenuItemProps =
  GlobalStandardProps
  & WorkbenchSideMenuOwnerProps
