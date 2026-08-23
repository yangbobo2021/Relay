import type { ComponentType } from 'react'

export const WORKBENCH_API_VERSION: 1
export const TERMINAL_PROVIDER_API_VERSION: 1

export type WorkbenchRegion = 'side' | 'bottom'
export interface WorkbenchIconProps { className?: string }
export interface WorkbenchViewDescriptor {
  id: string
  region: WorkbenchRegion
  title: string
  order?: number
  icon?: ComponentType<WorkbenchIconProps>
}
export interface WorkbenchPanelOwnerProps { closePanel(): void }

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'workbench.side.view': { kind: 'keyed'; scope: 'root'; owner: WorkbenchPanelOwnerProps }
    'workbench.bottom.view': { kind: 'keyed'; scope: 'root'; owner: WorkbenchPanelOwnerProps }
  }
}

export interface WorkbenchSnapshot { readonly views: readonly WorkbenchViewDescriptor[] }
export interface IWorkbench {
  readonly apiVersion: typeof WORKBENCH_API_VERSION
  registerView(descriptor: WorkbenchViewDescriptor): () => void
  getSnapshot(): WorkbenchSnapshot
  subscribe(listener: () => void): () => void
  openView(region: WorkbenchRegion, viewId: string): void
  toggleRegion(region: WorkbenchRegion): void
  closeRegion(region: WorkbenchRegion): void
}

export interface RelayTerminalProvider {
  readonly id: string
  readonly title: string
  whenReady(): Promise<void>
  request(method: string, params: unknown, options?: { timeoutMs?: number | null }): Promise<any>
  subscribeNotification(listener: (message: any) => void): () => void
}
export interface IRelayTerminalProviders {
  readonly apiVersion: typeof TERMINAL_PROVIDER_API_VERSION
  register(provider: RelayTerminalProvider): () => void
  list(): readonly RelayTerminalProvider[]
  get(providerId: string): RelayTerminalProvider | undefined
}
