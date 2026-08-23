export interface WorkbenchPanelOwnerProps {
  closePanel(): void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'workbench.bottom.terminal': { kind: 'single'; scope: 'root'; owner: WorkbenchPanelOwnerProps }
  }
}
