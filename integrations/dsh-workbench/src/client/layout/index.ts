import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { IWorkbench, WorkbenchPanelOwnerProps } from '@relay/dsh-plugin-contracts'
import type { PanelActions } from './service.ts'
import { AppFrame } from './AppFrame.tsx'
import { createLayoutStore } from './stores.ts'
import { WorkbenchController, type ILayout } from './service.ts'
import { ThemePresenter } from './theme-presenter.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    layout: ILayout
    workbench: IWorkbench
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'sidebar': { kind: 'single'; scope: 'root'; owner: SidebarOwnerProps }
    'conversation': { kind: 'single'; scope: 'session-maybe'; owner: ConvOwnerProps }
    'details': { kind: 'single'; scope: 'session'; owner: DetailsOwnerProps }
    'workbench.side.view': { kind: 'keyed'; scope: 'root'; owner: WorkbenchPanelOwnerProps }
    'workbench.bottom.view': { kind: 'keyed'; scope: 'root'; owner: WorkbenchPanelOwnerProps }
    'shell.overlay': { kind: 'list'; scope: 'root' }
  }
}

export interface SidebarOwnerProps { collapsed: boolean; width: number }
export interface ConvOwnerProps {}
export interface DetailsOwnerProps {}

export const inject = ['slots', 'theme']

export function apply(ctx: ClientContext): void {
  const workbench = new WorkbenchController()
  ctx.effect(() => {
    const disposeLayout = ctx.reflect.provide('layout', workbench)
    const disposeWorkbench = ctx.reflect.provide('workbench', workbench)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        'sidebar': { kind: 'single', scope: 'root' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'workbench.side.view': { kind: 'keyed', scope: 'root' },
        'workbench.bottom.view': { kind: 'keyed', scope: 'root' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      store: createLayoutStore,
      inject: (actions: PanelActions) => {
        workbench.attachPanels(actions)
        return { workbench }
      },
    }, AppFrame)
    return () => {
      disposeRegistration()
      void disposeWorkbench()
      void disposeLayout()
    }
  }, 'relay-workbench: services and root layout')

  ctx.effect(() => {
    const presenter = new ThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', snapshot => { presenter.apply(snapshot) })
    return () => { off(); presenter.dispose() }
  }, 'relay-workbench: theme presenter')
}
