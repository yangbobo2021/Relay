export const ADVANCED_DEBUG_STORAGE_KEY: string

export class AdvancedDebugPreference {
  readonly getSnapshot: () => boolean
  readonly subscribe: (listener: () => void) => () => void
  set(enabled: boolean): void
  dispose(): void
}
