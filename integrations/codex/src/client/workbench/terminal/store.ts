import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { TerminalSessionId } from './types.ts'

export interface TerminalPanelState {
  readonly terminalId?: TerminalSessionId
  readonly error?: string
}

const EMPTY: TerminalPanelState = Object.freeze({})

export class TerminalOutputStore {
  private readonly bySession = new Map<SessionId, TerminalPanelState>()
  private readonly listeners = new Set<() => void>()

  get(sessionId: SessionId | undefined): TerminalPanelState {
    if (sessionId === undefined) return EMPTY
    return this.bySession.get(sessionId) ?? EMPTY
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  attach(sessionId: SessionId, terminalId: TerminalSessionId): void {
    this.bySession.set(sessionId, { terminalId })
    this.publish()
  }

  fail(sessionId: SessionId, message: string): void {
    const current = this.get(sessionId)
    this.bySession.set(sessionId, { ...current, error: message })
    this.publish()
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
  }
}
