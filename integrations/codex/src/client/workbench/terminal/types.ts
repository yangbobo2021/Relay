import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkbenchPanelOwnerProps } from '../layout/index.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { TerminalOutputStore } from './store.ts'

export type TerminalSessionId = string

export interface TerminalSessionSnapshot {
  readonly sessionId: TerminalSessionId
  readonly name?: string
  readonly type: string
  readonly pid?: number
  readonly status: { readonly kind: 'running' } | { readonly kind: 'exited'; readonly exitCode: number | null; readonly signal: string | null }
}

export interface TerminalSpawnResult extends TerminalSessionSnapshot {
  readonly motd: string
}

export interface TerminalRawReadResult {
  readonly text: string
  readonly truncated: boolean
  readonly seq?: number
}

export interface WebTerminalSessionRequest {
  readonly sessionId: SessionId
}

export interface WebTerminalSpawnRequest {
  readonly sessionId: SessionId
  readonly type?: string
  readonly name?: string
  readonly cwd?: string
}

export interface WebTerminalTargetRequest {
  readonly sessionId: SessionId
  readonly terminalId: TerminalSessionId
}

export interface WebTerminalInputRequest extends WebTerminalTargetRequest {
  readonly data: string
}

export interface WebTerminalResizeRequest extends WebTerminalTargetRequest {
  readonly cols: number
  readonly rows: number
}

export interface WebTerminalAccepted {
  readonly accepted: true
}

export interface WebTerminalResized {
  readonly resized: true
}

export type WebTerminalResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

export interface WebTerminalRemote {
  list(request: WebTerminalSessionRequest): Promise<WebTerminalResult<readonly TerminalSessionSnapshot[]>>
  spawn(request: WebTerminalSpawnRequest): Promise<WebTerminalResult<TerminalSpawnResult>>
  readRaw(request: WebTerminalTargetRequest): Promise<WebTerminalResult<TerminalRawReadResult>>
  input(request: WebTerminalInputRequest): Promise<WebTerminalResult<WebTerminalAccepted>>
  resize(request: WebTerminalResizeRequest): Promise<WebTerminalResult<WebTerminalResized>>
}

export interface WebTerminalInjected {
  readonly webTerminal: WebTerminalRemote
  readonly store: TerminalOutputStore
}

export type WebTerminalPanelProps =
  GlobalStandardProps
  & WorkbenchPanelOwnerProps
  & WebTerminalInjected
