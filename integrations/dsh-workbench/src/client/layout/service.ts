import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  IWorkbench,
  WorkbenchRegion,
  WorkbenchSnapshot,
  WorkbenchViewDescriptor,
} from '@relay/dsh-plugin-contracts'
import type { createLayoutStore } from './stores.ts'

export type PanelActions = BoundActions<ReturnType<typeof createLayoutStore>>

export interface ILayout {
  toggleSidebar(): void
  openDetails(): void
  closeDetails(): void
}

const EMPTY_SNAPSHOT: WorkbenchSnapshot = Object.freeze({ views: Object.freeze([]) })

export class WorkbenchController implements ILayout, IWorkbench {
  readonly apiVersion = 1 as const
  #panels: PanelActions | undefined
  #views = new Map<string, WorkbenchViewDescriptor>()
  #listeners = new Set<() => void>()
  #snapshot = EMPTY_SNAPSHOT

  attachPanels(actions: PanelActions): void {
    this.#panels = actions
  }

  registerView(descriptor: WorkbenchViewDescriptor): () => void {
    validateDescriptor(descriptor)
    const key = viewKey(descriptor.region, descriptor.id)
    if (this.#views.has(key)) throw new Error(`workbench view ${key} is already registered`)
    const stored = Object.freeze({ ...descriptor })
    this.#views.set(key, stored)
    this.#publish()
    return () => {
      if (this.#views.get(key) !== stored) return
      this.#views.delete(key)
      this.#publish()
    }
  }

  getSnapshot = (): WorkbenchSnapshot => this.#snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  openView(region: WorkbenchRegion, viewId: string): void {
    if (!this.#views.has(viewKey(region, viewId))) throw new Error(`workbench view ${region}:${viewId} is not registered`)
    if (region === 'side') this.#require().activateSideView(viewId)
    else this.#require().activateBottomView(viewId)
  }

  toggleRegion(region: WorkbenchRegion): void {
    if (region === 'side') this.#require().toggleSidePanel()
    else this.#require().toggleBottomPanel()
  }

  closeRegion(region: WorkbenchRegion): void {
    if (region === 'side') this.#require().closeSidePanel()
    else this.#require().closeBottomPanel()
  }

  toggleSidebar(): void { this.#require().toggleSidebar() }
  openDetails(): void { this.#require().openDetails() }
  closeDetails(): void { this.#require().closeDetails() }

  #require(): PanelActions {
    if (this.#panels === undefined) throw new Error('workbench panel actions are not mounted')
    return this.#panels
  }

  #publish(): void {
    const views = [...this.#views.values()].sort((left, right) =>
      left.region.localeCompare(right.region)
      || (left.order ?? 0) - (right.order ?? 0)
      || left.id.localeCompare(right.id))
    this.#snapshot = Object.freeze({ views: Object.freeze(views) })
    for (const listener of this.#listeners) listener()
  }
}

function viewKey(region: WorkbenchRegion, id: string): string {
  return `${region}:${id}`
}

function validateDescriptor(descriptor: WorkbenchViewDescriptor): void {
  if (!descriptor.id || !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(descriptor.id)) {
    throw new Error('workbench view id must be lowercase and stable')
  }
  if (descriptor.region !== 'side' && descriptor.region !== 'bottom') throw new Error('workbench view region is invalid')
  if (!descriptor.title.trim()) throw new Error('workbench view title must be non-empty')
}
