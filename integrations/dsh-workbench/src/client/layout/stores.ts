import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import {
  BOTTOM_PANEL_DEFAULT, BOTTOM_PANEL_MAX, BOTTOM_PANEL_MIN,
  clampWidth, DETAILS_DEFAULT, DETAILS_MAX, DETAILS_MIN,
  SIDE_PANEL_DEFAULT, SIDE_PANEL_MAX, SIDE_PANEL_MIN,
  SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN,
} from './columns.ts'

export type LayoutState = {
  sidebar: number
  details: number
  sidePanel: number
  bottomPanel: number
  sideView: string
  bottomView: string
  narrow: boolean
  narrowExpanded: boolean
}

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
  selectSideView: (draft: LayoutState, viewId: string) => void
  activateSideView: (draft: LayoutState, viewId: string) => void
  toggleBottomPanel: (draft: LayoutState) => void
  closeBottomPanel: (draft: LayoutState) => void
  selectBottomView: (draft: LayoutState, viewId: string) => void
  activateBottomView: (draft: LayoutState, viewId: string) => void
}

export function createLayoutStore(): EngineStoreHandle<LayoutState, LayoutActions> {
  return defineStore({
    init: (): LayoutState => ({
      sidebar: SIDEBAR_DEFAULT,
      details: 0,
      sidePanel: 0,
      bottomPanel: 0,
      sideView: '',
      bottomView: '',
      narrow: false,
      narrowExpanded: false,
    }),
    actions: {
      setSidebar: (d, px: number) => { d.sidebar = clampWidth(px, SIDEBAR_MIN, SIDEBAR_MAX) },
      setDetails: (d, px: number) => { d.details = clampWidth(px, DETAILS_MIN, DETAILS_MAX) },
      setSidePanel: (d, px: number) => { d.sidePanel = clampWidth(px, SIDE_PANEL_MIN, SIDE_PANEL_MAX) },
      setBottomPanel: (d, px: number) => { d.bottomPanel = clampWidth(px, BOTTOM_PANEL_MIN, BOTTOM_PANEL_MAX) },
      toggleSidebar: (d) => {
        if (d.narrow) d.narrowExpanded = !d.narrowExpanded
        else d.sidebar = d.sidebar === 0 ? SIDEBAR_DEFAULT : 0
      },
      setNarrow: (d, narrow: boolean) => {
        if (d.narrow === narrow) return
        d.narrow = narrow
        d.narrowExpanded = false
      },
      openDetails: (d) => { if (d.details === 0) d.details = DETAILS_DEFAULT },
      closeDetails: (d) => { d.details = 0 },
      toggleSidePanel: (d) => { d.sidePanel = d.sidePanel === 0 ? SIDE_PANEL_DEFAULT : 0 },
      closeSidePanel: (d) => { d.sidePanel = 0 },
      selectSideView: (d, viewId: string) => { d.sideView = viewId },
      activateSideView: (d, viewId: string) => {
        d.sideView = viewId
        if (d.sidePanel === 0) d.sidePanel = SIDE_PANEL_DEFAULT
      },
      toggleBottomPanel: (d) => { d.bottomPanel = d.bottomPanel === 0 ? BOTTOM_PANEL_DEFAULT : 0 },
      closeBottomPanel: (d) => { d.bottomPanel = 0 },
      selectBottomView: (d, viewId: string) => { d.bottomView = viewId },
      activateBottomView: (d, viewId: string) => {
        d.bottomView = viewId
        if (d.bottomPanel === 0) d.bottomPanel = BOTTOM_PANEL_DEFAULT
      },
    },
  })
}
