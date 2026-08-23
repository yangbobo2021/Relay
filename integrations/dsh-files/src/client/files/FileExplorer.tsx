import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  IconChevronDownOutline14,
  IconChevronRightOutline14,
  IconBrowseOutline16,
  IconFolderClose16,
  IconFolderOpenOutline16,
  IconSearchOutline16,
  MarkdownText,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { FileExplorerProps, WorkspaceFileEntry, WorkspaceFileListing } from './types.ts'
import css from './FileExplorer.module.css'

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; listing: WorkspaceFileListing }
  | { kind: 'error'; message: string }

function basename(path: string): string {
  const normalized = path.replace(/\/+$/, '')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || normalized
}

function isMarkdown(path: string): boolean {
  return /\.(?:md|mdx|markdown)$/i.test(path)
}

export function FileExplorer({ store, useSessions, workspaceFiles }: FileExplorerProps) {
  const sessions = useSessions(s => s)
  const sessionId = sessions.current
  const cwd = sessionId === undefined ? undefined : sessions.byId[sessionId]?.cwd
  const [filter, setFilter] = useState('')
  const [treeVisible, setTreeVisible] = useState(true)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [directories, setDirectories] = useState<ReadonlyMap<string, WorkspaceFileListing>>(() => new Map())
  const [loadingDirectories, setLoadingDirectories] = useState<ReadonlySet<string>>(() => new Set())
  const [treeError, setTreeError] = useState<string>()
  const generation = useRef(0)
  const treeRows = useRef(new Map<string, HTMLButtonElement>())
  const documents = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const preview = documents.files.find(file => file.path === documents.activePath)

  useEffect(() => {
    setFilter('')
    setTreeVisible(true)
    setExpanded(new Set())
    setDirectories(new Map())
    setLoadingDirectories(new Set())
    setTreeError(undefined)
    store.setSession(sessionId)
    setPhase({ kind: sessionId === undefined ? 'idle' : 'loading' })
  }, [sessionId, store])

  useEffect(() => {
    if (sessionId === undefined || cwd === undefined) {
      setPhase({ kind: 'idle' })
      return
    }
    let alive = true
    const requestGeneration = ++generation.current
    setPhase({ kind: 'loading' })
    setExpanded(new Set())
    setDirectories(new Map())
    setLoadingDirectories(new Set())
    setTreeError(undefined)
    void workspaceFiles.list({ sessionId, path: '.' }).then((result) => {
      if (!alive || requestGeneration !== generation.current) return
      if (result.ok) setPhase({ kind: 'ready', listing: result.value })
      else setPhase({ kind: 'error', message: result.error.message })
    })
    return () => { alive = false }
  }, [cwd, sessionId, workspaceFiles])

  const workspaceName = useMemo(() => cwd === undefined ? 'Files' : basename(cwd), [cwd])

  const openFile = (entry: WorkspaceFileEntry): void => {
    if (sessionId === undefined) return
    if (entry.type !== 'file') return
    if (store.has(entry.path)) {
      store.activate(entry.path)
      return
    }
    const requestGeneration = generation.current
    void workspaceFiles.readText({ sessionId, path: entry.path }).then((result) => {
      if (requestGeneration !== generation.current) return
      if (!result.ok) {
        setTreeError(result.error.message)
        return
      }
      setTreeError(undefined)
      store.open(result.value, !isMarkdown(result.value.path))
    })
  }

  const toggleDirectory = (entry: WorkspaceFileEntry): void => {
    if (sessionId === undefined || entry.type !== 'directory') return
    if (expanded.has(entry.path)) {
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(entry.path)
        return next
      })
      return
    }

    setExpanded(current => new Set(current).add(entry.path))
    if (directories.has(entry.path)) return
    const requestGeneration = generation.current
    setLoadingDirectories(current => new Set(current).add(entry.path))
    void workspaceFiles.list({ sessionId, path: entry.path }).then((result) => {
      if (requestGeneration !== generation.current) return
      setLoadingDirectories((current) => {
        const next = new Set(current)
        next.delete(entry.path)
        return next
      })
      if (!result.ok) {
        setTreeError(result.error.message)
        return
      }
      setTreeError(undefined)
      setDirectories(current => new Map(current).set(entry.path, result.value))
    })
  }

  const listing = phase.kind === 'ready' ? phase.listing : undefined
  const query = filter.trim().toLocaleLowerCase()

  useEffect(() => {
    if (preview === undefined || listing === undefined || !treeVisible) return
    const relativePath = preview.path.slice(listing.root.length + 1)
    const segments = relativePath.split('/').filter(Boolean)
    if (segments.length > 1) {
      setExpanded((current) => {
        const next = new Set(current)
        let parent = listing.root
        for (const segment of segments.slice(0, -1)) {
          parent = `${parent}/${segment}`
          next.add(parent)
        }
        return next
      })
    }
    const frame = requestAnimationFrame(() => {
      const row = treeRows.current.get(preview.path)
      if (row !== undefined && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ block: 'nearest' })
      }
    })
    return () => { cancelAnimationFrame(frame) }
  }, [listing, preview, treeVisible])

  const renderEntries = (entries: readonly WorkspaceFileEntry[], depth = 0): React.ReactNode => entries.map((entry) => {
    const directory = entry.type === 'directory'
    const isExpanded = directory && expanded.has(entry.path)
    const childListing = directory ? directories.get(entry.path) : undefined
    const visible = query.length === 0 || entry.name.toLocaleLowerCase().includes(query)
    return (
      <Fragment key={`${entry.type}:${entry.path}`}>
        {visible && (
          <button
            type="button"
            ref={(element) => {
              if (element === null) treeRows.current.delete(entry.path)
              else treeRows.current.set(entry.path, element)
            }}
            className={css.row}
            style={{ paddingLeft: 4 + depth * 18 }}
            data-kind={entry.type}
            data-selected={preview?.path === entry.path || undefined}
            aria-expanded={directory ? isExpanded : undefined}
            aria-selected={directory ? undefined : preview?.path === entry.path}
            onClick={() => { if (directory) toggleDirectory(entry); else openFile(entry) }}
            role="treeitem"
          >
            {directory
              ? isExpanded
                ? <IconChevronDownOutline14 className={css.disclosure} />
                : <IconChevronRightOutline14 className={css.disclosure} />
              : <span className={css.disclosure} />}
            <span className={css.fileIcon}>
              {directory
                ? isExpanded ? <IconFolderOpenOutline16 /> : <IconFolderClose16 />
                : <IconBrowseOutline16 />}
            </span>
            <span className={css.name}>{entry.name}</span>
          </button>
        )}
        {isExpanded && (
          <div role="group">
            {loadingDirectories.has(entry.path) && (
              <div className={css.treeStatus} style={{ paddingLeft: 40 + depth * 18 }}>Loading...</div>
            )}
            {childListing !== undefined && renderEntries(childListing.entries, depth + 1)}
            {childListing !== undefined && childListing.entries.length === 0 && (
              <div className={css.treeStatus} style={{ paddingLeft: 40 + depth * 18 }}>Empty folder</div>
            )}
          </div>
        )}
      </Fragment>
    )
  })

  const tree = listing === undefined ? null : (
    <div className={css.tree}>
      <label className={css.search}>
        <IconSearchOutline16 />
        <input
          value={filter}
          aria-label="Filter files"
          placeholder="Filter files..."
          onChange={(event) => { setFilter(event.target.value) }}
        />
      </label>
      <div className={css.list} role="tree" aria-label="Workspace files">
        {listing.entries.length === 0 && <div className={css.empty}>No matching files.</div>}
        {renderEntries(listing.entries)}
        {treeError !== undefined && <div className={css.error}>{treeError}</div>}
      </div>
    </div>
  )
  const relativeSegments = preview === undefined
    ? []
    : preview.path.slice((listing?.root.length ?? 0) + 1).split('/').filter(Boolean)
  const breadcrumbTitle = preview === undefined ? '/' : [workspaceName, ...relativeSegments].join('/')

  return (
    <section className={css.root} aria-label="Files" data-file-open={preview !== undefined || undefined}>
      <div className={css.toolbar}>
        <div className={css.breadcrumb} title={breadcrumbTitle}>
          {preview === undefined
            ? <span className={css.path}>/</span>
            : (
              <>
                <span className={css.workspace}>{workspaceName}</span>
                {relativeSegments.map((segment, index) => (
                  <Fragment key={`${segment}:${index}`}>
                    <IconChevronRightOutline14 />
                    <span className={css.path}>{segment}</span>
                  </Fragment>
                ))}
              </>
            )}
        </div>
        {preview !== undefined && isMarkdown(preview.path) && (
          <button type="button" className={css.textButton} onClick={() => { store.toggleSource(preview.path) }}>
            {preview.sourceView ? 'Preview' : 'View source'}
          </button>
        )}
        <Tooltip label={treeVisible ? 'Hide file tree' : 'Show file tree'} side="bottom" delayMs={400}>
          <button
            type="button"
            className={css.iconButton}
            data-active={treeVisible || undefined}
            aria-label={treeVisible ? 'Hide file tree' : 'Show file tree'}
            aria-pressed={treeVisible}
            onClick={() => { setTreeVisible(visible => !visible) }}
          >
            <IconFolderOpenOutline16 />
          </button>
        </Tooltip>
      </div>

      <div className={css.body}>
        {phase.kind === 'idle' && <div className={css.empty}>Open a workspace session to browse files.</div>}
        {phase.kind === 'loading' && <div className={css.empty}>Loading files...</div>}
        {phase.kind === 'error' && <div className={css.error}>{phase.message}</div>}
        {phase.kind === 'ready' && (
          <div className={css.fileWorkspace} data-tree-visible={treeVisible || undefined}>
            <article className={css.reader} aria-label={preview === undefined ? 'Open file content' : `File content ${basename(preview.path)}`}>
              {preview === undefined
                ? (
                  <div className={css.openFile}>
                    <IconFolderOpenOutline16 size={32} />
                    <strong>Open file</strong>
                    <span>Select a file from the workspace tree</span>
                  </div>
                )
                : preview.sourceView
                  ? <pre className={css.source}>{preview.content}{preview.truncated ? '\n[truncated]' : ''}</pre>
                  : <div className={css.document}><MarkdownText text={preview.content} /></div>}
            </article>
            {treeVisible && <aside className={css.treePane} aria-label="File tree">{tree}</aside>}
          </div>
        )}
      </div>
    </section>
  )
}
