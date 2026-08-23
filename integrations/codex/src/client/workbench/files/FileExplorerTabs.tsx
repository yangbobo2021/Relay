import { useSyncExternalStore } from 'react'
import {
  IconCloseOutline16,
  IconBrowseOutline16,
  IconFolderOpenOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { FileMenuItemProps, FileTabsProps } from './types.ts'
import css from './FileExplorer.module.css'

function basename(path: string): string {
  const normalized = path.replace(/\/+$/, '')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || normalized
}

export function FileTabs(props: FileTabsProps) {
  const state = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot)
  if (state.files.length === 0) {
    return (
      <div
        className={css.fileTab}
        role="tab"
        aria-selected={props.activeView === 'files'}
        tabIndex={0}
        onClick={() => { props.activateView('files') }}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') props.activateView('files') }}
      >
        <IconBrowseOutline16 />
        <span>Open file</span>
        <button type="button" aria-label="Close Open file" onClick={(event) => { event.stopPropagation(); props.closePanel() }}>
          <IconCloseOutline16 />
        </button>
      </div>
    )
  }
  return state.files.map(file => (
    <div
      key={file.path}
      className={css.fileTab}
      role="tab"
      aria-selected={props.activeView === 'files' && state.activePath === file.path}
      tabIndex={state.activePath === file.path ? 0 : -1}
      title={file.path}
      onClick={() => { props.store.activate(file.path); props.activateView('files') }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          props.store.activate(file.path)
          props.activateView('files')
        }
      }}
    >
      <IconBrowseOutline16 />
      <span>{basename(file.path)}</span>
      <button
        type="button"
        aria-label={`Close ${basename(file.path)}`}
        onClick={(event) => { event.stopPropagation(); props.store.close(file.path) }}
      >
        <IconCloseOutline16 />
      </button>
    </div>
  ))
}

export function FileMenuItem(props: FileMenuItemProps) {
  return (
    <button
      type="button"
      className={css.viewMenuItem}
      role="menuitem"
      aria-current={props.activeView === 'files' ? 'page' : undefined}
      onClick={() => { props.activateView('files') }}
    >
      <IconFolderOpenOutline16 />
      <span>Files</span>
    </button>
  )
}
