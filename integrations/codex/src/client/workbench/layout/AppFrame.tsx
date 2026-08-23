/**
 * Three-column shell frame, registered into the built-in 'root' slot (the web
 * shell renders only 'root'). Owns the grid tracks (sidebar | center |
 * details), the drag handles (pointer capture + rAF throttle), the concession
 * chain (columns.ts), and the child-slot render decisions: the sidebar slot
 * renders HERE with live parameters from the concession solve, and the
 * session-aware occupants render in fixed column positions; strict entries
 * gate themselves on current-session availability while session-maybe
 * entries retain identity. Pure component: everything arrives
 * through the three framework shares — zero cordis or framework imports,
 * zero self-made hooks.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconCodeOutline16,
  IconFolderOpenOutline16,
  IconListPenOutline16,
  IconPanelLeftOutline16,
  IconPlusOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  BOTTOM_PANEL_MIN,
  CENTER_MIN,
  computeColumns,
  SIDE_PANEL_MAX,
  SIDE_PANEL_MIN,
  SIDEBAR_AUTO_COLLAPSE,
  SIDEBAR_DEFAULT,
} from './columns.ts'
import type { createLayoutStore } from './stores.ts'
import css from './AppFrame.module.css'

/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<
    'sidebar' | 'conversation' | 'details' | 'workbench.side.tabs' | 'workbench.side.menu'
    | 'workbench.side.view' | 'workbench.bottom.terminal' | 'shell.overlay'
  >
  & PropsStore<ReturnType<typeof createLayoutStore>>

/** Right column keeps both surfaces mounted and switches only visibility. */
function RightColumn(props: { sideOpen: boolean; details?: ReactNode; auxiliary?: ReactNode }) {
  return (
    <div className={css.rightCol}>
      <div className={css.rightSurface} data-active={!props.sideOpen || undefined}>{props.details}</div>
      <div className={css.rightSurface} data-active={props.sideOpen || undefined}>{props.auxiliary}</div>
    </div>
  )
}

function AuxiliaryWorkspace(props: {
  activeView: string
  activateView: (viewId: string) => void
  closePanel: () => void
  renderTabs: (owner: { activeView: string; activateView: (viewId: string) => void; closePanel: () => void }) => ReactNode
  renderMenu: (owner: { activeView: string; activateView: (viewId: string) => void }) => ReactNode
  renderView: (viewId: string) => ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [menuOpen])
  const activateView = (viewId: string): void => {
    props.activateView(viewId)
    setMenuOpen(false)
  }
  return (
    <section ref={root} className={css.auxiliary} aria-label="Auxiliary workspace">
      <header className={css.auxiliaryTabs}>
        <div className={css.auxiliaryTabList} role="tablist" aria-label="Auxiliary views">
          {props.renderTabs({ activeView: props.activeView, activateView, closePanel: props.closePanel })}
        </div>
        <Tooltip label="Add auxiliary view" side="bottom" delayMs={400}>
          <button
            type="button"
            className={css.auxiliaryButton}
            aria-label="Add auxiliary view"
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen(open => !open) }}
          >
            <IconPlusOutline16 />
          </button>
        </Tooltip>
        <span className={css.auxiliarySpacer} />
        <Tooltip label="Close side panel" side="bottom" delayMs={400}>
          <button type="button" className={css.auxiliaryButton} aria-label="Close side panel" onClick={props.closePanel}>
            <IconPanelLeftOutline16 className={css.sidePanelIcon} />
          </button>
        </Tooltip>
        {menuOpen && (
          <div className={css.auxiliaryMenu} role="menu" aria-label="Auxiliary views menu">
            {props.renderMenu({ activeView: props.activeView, activateView })}
          </div>
        )}
      </header>
      <div className={css.auxiliaryView}>{props.renderView(props.activeView)}</div>
    </section>
  )
}

/**
 * One drag handle: pointer capture, rAF-throttled dx reports against the drag-start origin.
 * `side` keys the hover-reveal CSS to the owning column.
 */
function DragHandle(props: { side: 'sidebar' | 'details'; left: number; onStart: () => void; onDrag: (dx: number) => void; onEnd: () => void }) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd })
  callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = e.clientX
    latest.current = e.clientX
    callbacks.current.onStart()
    setDragging(true)
  }, [])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    latest.current = e.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    callbacks.current.onDrag(latest.current - origin.current)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])

  return (
    <div
      className={css.handle}
      style={{ left: props.left }}
      data-side={props.side}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}

/** Horizontal splitter for the frame-owned bottom panel. */
function BottomDragHandle(props: { top: number; onStart: () => void; onDrag: (dy: number) => void; onEnd: () => void }) {
  const [dragging, setDragging] = useState(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const callbacks = useRef({ onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd })
  callbacks.current = { onStart: props.onStart, onDrag: props.onDrag, onEnd: props.onEnd }
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    origin.current = event.clientY
    latest.current = event.clientY
    callbacks.current.onStart()
    setDragging(true)
  }, [])
  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    latest.current = event.clientY
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callbacks.current.onDrag(latest.current - origin.current)
    })
  }, [])
  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    callbacks.current.onDrag(latest.current - origin.current)
    setDragging(false)
    callbacks.current.onEnd()
  }, [])
  return (
    <div
      className={css.bottomHandle}
      style={{ top: props.top }}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}

function WorkbenchToolbar(props: {
  bottomOpen: boolean
  sideOpen: boolean
  toggleBottom: () => void
  toggleSide: () => void
  openFiles: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [menuOpen])

  const openBottom = () => {
    if (!props.bottomOpen) props.toggleBottom()
    setMenuOpen(false)
  }
  const openSide = () => {
    props.openFiles()
    setMenuOpen(false)
  }

  return (
    <div ref={root} className={css.workbenchToolbar}>
      <Tooltip label="Panels" side="bottom" delayMs={400}>
        <button
          type="button"
          className={css.toolbarButton}
          aria-label="Open panel menu"
          aria-expanded={menuOpen}
          onClick={() => { setMenuOpen(open => !open) }}
        >
          <IconListPenOutline16 />
        </button>
      </Tooltip>
      <Tooltip label="Toggle bottom panel" side="bottom" delayMs={400}>
        <button
          type="button"
          className={css.toolbarButton}
          data-active={props.bottomOpen || undefined}
          aria-label="Toggle bottom panel"
          aria-pressed={props.bottomOpen}
          onClick={props.toggleBottom}
        >
          <IconPanelLeftOutline16 className={css.bottomPanelIcon} />
        </button>
      </Tooltip>
      <Tooltip label="Toggle side panel" side="bottom" delayMs={400}>
        <button
          type="button"
          className={css.toolbarButton}
          data-active={props.sideOpen || undefined}
          aria-label="Toggle side panel"
          aria-pressed={props.sideOpen}
          onClick={props.toggleSide}
        >
          <IconPanelLeftOutline16 className={css.sidePanelIcon} />
        </button>
      </Tooltip>
      {menuOpen && (
        <div className={css.panelMenu} role="menu" aria-label="Workbench panels">
          <button type="button" role="menuitem" onClick={openBottom}>
            <IconCodeOutline16 />
            <span>Terminal</span>
          </button>
          <button type="button" role="menuitem" onClick={openSide}>
            <IconFolderOpenOutline16 />
            <span>Files</span>
          </button>
        </div>
      )}
    </div>
  )
}

/** The workbench frame (navigation | conversation + terminal | details/files). */
export function AppFrame({
  useStore,
  useSessions,
  actions,
  renderSlot,
}: AppFrameProps) {
  const panels = useStore(s => s)
  const detailsSession = useSessions((s) => {
    const current = s.current
    return current !== undefined && s.byId[current]?.blank === false ? current : undefined
  })
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(() => window.innerWidth)
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight)

  const lastSession = useRef(detailsSession)
  useLayoutEffect(() => {
    if (detailsSession === undefined) return
    if (lastSession.current !== undefined && lastSession.current !== detailsSession) {
      actions.closeDetails()
    }
    lastSession.current = detailsSession
  }, [actions, detailsSession])

  // Track the frame's own box (not the window): rAF-throttled ResizeObserver.
  useEffect(() => {
    const el = frameRef.current
    /* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
    if (el === null) return
    let raf: number | null = null
    const observer = new ResizeObserver(() => {
      raf ??= requestAnimationFrame(() => {
        raf = null
        const rect = el.getBoundingClientRect()
        const width = rect.width
        if (width > 0) setViewport(width)
        if (rect.height > 0) setViewportHeight(rect.height)
      })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  // Narrow viewports auto-collapse the sidebar; the store mirror keeps
  // toggleSidebar's semantics right (narrow toggles flip the manual
  // re-expand override, stores.ts). Collapsed is decided here, so the
  // solver stays breakpoint-free: a narrow re-expand passes the preference
  // (or the default when the wide preference is closed) and the center
  // absorbs the squeeze.
  const sideOpen = panels.sidePanel > 0
  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE
  useEffect(() => { actions.setNarrow(narrow) }, [actions, narrow])
  const filesNeedSidebarRail = sideOpen
    && panels.sidebar > 0
    && viewport < panels.sidebar + SIDE_PANEL_MIN + CENTER_MIN
  const sidebarCollapsed = narrow
    ? !panels.narrowExpanded
    : panels.sidebar === 0 || filesNeedSidebarRail
  const sidebarPreference = sidebarCollapsed
    ? 0
    : panels.sidebar === 0 ? SIDEBAR_DEFAULT : panels.sidebar
  const bottomOpen = panels.bottomPanel > 0
  const rightPreference = sideOpen ? panels.sidePanel : detailsSession === undefined ? 0 : panels.details
  const cols = computeColumns(
    viewport,
    sidebarPreference,
    rightPreference,
    sideOpen ? { min: SIDE_PANEL_MIN, max: SIDE_PANEL_MAX, preserveMinimum: true } : undefined,
  )
  const bottomHeight = bottomOpen
    ? Math.min(panels.bottomPanel, Math.max(BOTTOM_PANEL_MIN, viewportHeight - 260))
    : 0
  const colsRef = useRef(cols)
  colsRef.current = cols

  // The drag base is the rendered width captured at drag start (grabbing a
  // concession-clamped panel must not jump back to the stored preference);
  // it stays frozen for the whole gesture so dx deltas do not compound.
  const sidebarBase = useRef(0)
  const detailsBase = useRef(0)
  const bottomBase = useRef(0)
  // Track-level transitions pause for the whole gesture: eased tracks would
  // detach the column edge from the pointer (AppFrame.module.css).
  const [dragging, setDragging] = useState(false)
  const onDragEnd = useCallback(() => { setDragging(false) }, [])
  const onSidebarStart = useCallback(() => { sidebarBase.current = colsRef.current.sidebar; setDragging(true) }, [])
  const onDetailsStart = useCallback(() => { detailsBase.current = colsRef.current.details; setDragging(true) }, [])
  const onSidebarDrag = useCallback((dx: number) => {
    actions.setSidebar(sidebarBase.current + dx)
  }, [actions])
  const onDetailsDrag = useCallback((dx: number) => {
    if (sideOpen) actions.setSidePanel(detailsBase.current - dx)
    else actions.setDetails(detailsBase.current - dx)
  }, [actions, sideOpen])
  const onBottomStart = useCallback(() => { bottomBase.current = bottomHeight; setDragging(true) }, [bottomHeight])
  const onBottomDrag = useCallback((dy: number) => {
    actions.setBottomPanel(bottomBase.current - dy)
  }, [actions])

  return (
    <div
      ref={frameRef}
      className={css.frame}
      style={{ gridTemplateColumns: `${cols.sidebar}px minmax(0, 1fr) ${cols.details}px` }}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-details-collapsed={cols.details === 0 || undefined}
      data-bottom-collapsed={bottomHeight === 0 || undefined}
      data-dragging={dragging || undefined}
    >
      <div className={css.sidebarCol}>
        {/* Render-site slot call with live concession output: a closed
            sidebar keeps the mounted slot at the compact-rail width, and the
            component sees its rendered state as owner params decided here
            (collapsed follows the resolved rail, so a derived auto-collapse
            renders the rail UI too). */}
        {renderSlot('sidebar', {
          collapsed: sidebarCollapsed,
          width: cols.sidebar,
        })}
      </div>
      <div
        className={css.centerStack}
        style={{ gridTemplateRows: `minmax(0, 1fr) ${bottomHeight}px` }}
      >
        <div className={css.centerCol}>{renderSlot('conversation', {})}</div>
        <div className={css.bottomCol}>
          {renderSlot('workbench.bottom.terminal', { closePanel: actions.closeBottomPanel })}
        </div>
        <WorkbenchToolbar
          bottomOpen={bottomOpen}
          sideOpen={sideOpen}
          toggleBottom={actions.toggleBottomPanel}
          toggleSide={actions.toggleSidePanel}
          openFiles={() => { actions.activateSideView('files') }}
        />
        {bottomHeight > 0 && (
          <BottomDragHandle
            top={viewportHeight - bottomHeight}
            onStart={onBottomStart}
            onDrag={onBottomDrag}
            onEnd={onDragEnd}
          />
        )}
      </div>
      <RightColumn
        sideOpen={sideOpen}
        details={renderSlot('details', {})}
        auxiliary={(
          <AuxiliaryWorkspace
            activeView={panels.sideView}
            activateView={actions.activateSideView}
            closePanel={actions.closeSidePanel}
            renderTabs={owner => renderSlot('workbench.side.tabs', owner)}
            renderMenu={owner => renderSlot('workbench.side.menu', owner)}
            renderView={viewId => renderSlot('workbench.side.view', { closePanel: actions.closeSidePanel }, { entryKey: viewId })}
          />
        )}
      />
      <div className={css.overlayLayer} data-shell-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
      {/* The collapsed rail is fixed-width: no resize handle while closed. */}
      {!sidebarCollapsed && <DragHandle side="sidebar" left={cols.sidebar} onStart={onSidebarStart} onDrag={onSidebarDrag} onEnd={onDragEnd} />}
      {cols.details > 0 && <DragHandle side="details" left={viewport - cols.details} onStart={onDetailsStart} onDrag={onDetailsDrag} onEnd={onDragEnd} />}
    </div>
  )
}
