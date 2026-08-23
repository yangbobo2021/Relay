/**
 * The root entry's transient layout store: panel geometry as plain widths in
 * px (0 = closed). Module level exports the factory only — a module-level
 * handle would pin the store's identity in the module
 * cache (a de-facto singleton surviving plugin reloads). register() receives
 * the factory (exclusive use: the framework instantiates per entry), AppFrame
 * derives its PropsStore share from the return type, and the service face
 * receives the bound actions through the registration's inject hook.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import {
  BOTTOM_PANEL_DEFAULT, BOTTOM_PANEL_MAX, BOTTOM_PANEL_MIN,
  clampWidth, DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN,
  SIDE_PANEL_DEFAULT, SIDE_PANEL_MAX, SIDE_PANEL_MIN,
  SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN,
} from './columns.ts'

/**
 * Layout store state: panel width preferences in px (0 = closed), plus the
 * narrow-viewport pair — `narrow` mirrors AppFrame's breakpoint reading
 * (viewport < SIDEBAR_AUTO_COLLAPSE) so toggleSidebar can pick semantics, and
 * `narrowExpanded` is the manual override that re-expands the auto-collapsed
 * sidebar over the squeezed center without rewriting the width preference.
 */
type LayoutState = {
  sidebar: number
  details: number
  sidePanel: number
  bottomPanel: number
  sideView: string
  narrow: boolean
  narrowExpanded: boolean
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type LayoutActions = {
  setSidebar: (draft: LayoutState, px: number) => void
  setDetails: (draft: LayoutState, px: number) => void
  setSidePanel: (draft: LayoutState, px: number) => void
  setBottomPanel: (draft: LayoutState, px: number) => void
  toggleSidebar: (draft: LayoutState) => void
  setNarrow: (draft: LayoutState, narrow: boolean) => void
  openDetails: (draft: LayoutState) => void
  closeDetails: (draft: LayoutState) => void
  toggleSidePanel: (draft: LayoutState) => void
  closeSidePanel: (draft: LayoutState) => void
  activateSideView: (draft: LayoutState, viewId: string) => void
  toggleBottomPanel: (draft: LayoutState) => void
  closeBottomPanel: (draft: LayoutState) => void
}

/**
 * Create the layout panel store handle. The preference IS the width, so
 * closing a panel forgets its drag width — reopening restores the contract
 * default. Actions are the complete write set: drag writes clamp
 * into the panel's contract range and never cross the open/closed line;
 * open/close transitions write 0 / the default explicitly. Below the
 * auto-collapse breakpoint (AppFrame feeds setNarrow) the sidebar toggle
 * flips the narrowExpanded override instead of the preference.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createLayoutStore(): EngineStoreHandle<LayoutState, LayoutActions>  {
  const handle = defineStore({
    init: (): LayoutState => ({
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      sidePanel: 0,
      bottomPanel: 0,
      sideView: 'files',
      narrow: false,
      narrowExpanded: false,
    }),
    actions: {
      setSidebar: (d, px: number) => { d.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX) },
      setDetails: (d, px: number) => { d.details = clampWidth(px, DETAILS_MIN, DETAILS_MAX) },
      setSidePanel: (d, px: number) => { d.sidePanel = clampWidth(px, SIDE_PANEL_MIN, SIDE_PANEL_MAX) },
      setBottomPanel: (d, px: number) => {
        d.bottomPanel = clampWidth(px, BOTTOM_PANEL_MIN, BOTTOM_PANEL_MAX)
      },
      // Narrow toggles flip only the override: the width preference survives
      // untouched, so re-widening restores the pre-squeeze layout.
      toggleSidebar: (d) => {
        if (d.narrow) d.narrowExpanded = !d.narrowExpanded
        else d.sidebar = d.sidebar === 0 ? SIDEBAR_DEFAULT : 0
      },
      // Crossing the breakpoint in either direction drops the override: the
      // narrow default is auto-collapsed, the wide state is the preference.
      setNarrow: (d, narrow: boolean) => {
        if (d.narrow === narrow) return
        d.narrow = narrow
        d.narrowExpanded = false
      },
      openDetails: (d) => { if (d.details === 0) d.details = DETAILS_DEFAULT },
      closeDetails: (d) => { d.details = 0 },
      toggleSidePanel: (d) => {
        d.sidePanel = d.sidePanel === 0 ? SIDE_PANEL_DEFAULT : 0
      },
      closeSidePanel: (d) => { d.sidePanel = 0 },
      activateSideView: (d, viewId: string) => {
        d.sideView = viewId
        if (d.sidePanel === 0) d.sidePanel = SIDE_PANEL_DEFAULT
      },
      toggleBottomPanel: (d) => {
        d.bottomPanel = d.bottomPanel === 0 ? BOTTOM_PANEL_DEFAULT : 0
      },
      closeBottomPanel: (d) => { d.bottomPanel = 0 },
    },
  })
  return handle
}
