import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import {
  IconCloseOutline16,
  IconCodeOutline16,
  IconPlusOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { TerminalSessionId, WebTerminalPanelProps } from './types.ts'
import css from './WebTerminalPanel.module.css'

interface ActiveTerminal {
  readonly sessionId: SessionId
  readonly terminalId: TerminalSessionId
  readonly generation: number
  text: string
  seq: number
}

function basename(path: string | undefined): string {
  if (path === undefined) return 'Terminal'
  const normalized = path.replace(/\/+$/, '')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || 'Terminal'
}

function terminalTheme(element: HTMLElement) {
  const styles = getComputedStyle(element)
  const read = (name: string, fallback: string): string => styles.getPropertyValue(name).trim() || fallback
  return {
    background: read('--dsw-alias-bg-base', '#ffffff'),
    foreground: read('--dsw-alias-label-primary', '#202124'),
    cursor: read('--dsw-alias-label-primary', '#202124'),
    cursorAccent: read('--dsw-alias-bg-base', '#ffffff'),
    selectionBackground: 'rgba(70, 117, 221, 0.24)',
    black: '#1f2328',
    red: '#cf222e',
    green: '#1a7f37',
    yellow: '#9a6700',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#f6f8fa',
    brightBlack: '#57606a',
    brightRed: '#ff7b72',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff',
  }
}

export function WebTerminalPanel(props: WebTerminalPanelProps) {
  const { webTerminal, store } = props
  const sessions = props.useSessions(s => s)
  const sessionId = sessions.current
  const cwd = sessionId === undefined ? undefined : sessions.byId[sessionId]?.cwd
  const state = useSyncExternalStore(store.subscribe, () => store.get(sessionId), () => store.get(sessionId))
  const mountRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal>()
  const fitRef = useRef<FitAddon>()
  const activeRef = useRef<ActiveTerminal>()
  const generationRef = useRef(0)
  const inputTailRef = useRef<Promise<void>>(Promise.resolve())
  const lastSizeRef = useRef<{ terminalId: TerminalSessionId; cols: number; rows: number }>()
  const [starting, setStarting] = useState(false)

  const reportFailure = useCallback((target: SessionId, error: unknown): void => {
    store.fail(target, error instanceof Error ? error.message : String(error))
  }, [store])

  const enqueueInput = useCallback((data: string): void => {
    const active = activeRef.current
    if (active === undefined || data.length === 0) return
    const target = { sessionId: active.sessionId, terminalId: active.terminalId, data }
    inputTailRef.current = inputTailRef.current.then(async () => {
      const result = await webTerminal.input(target)
      if (!result.ok) store.fail(target.sessionId, result.error.message)
    }).catch((error: unknown) => { reportFailure(target.sessionId, error) })
  }, [reportFailure, store, webTerminal])

  const fitAndFocus = useCallback((): void => {
    queueMicrotask(() => {
      fitRef.current?.fit()
      terminalRef.current?.focus()
    })
  }, [])

  const attach = useCallback(async (targetSession: SessionId, terminalId: TerminalSessionId): Promise<void> => {
    const terminal = terminalRef.current
    if (terminal === undefined) return
    const generation = ++generationRef.current
    const active: ActiveTerminal = {
      sessionId: targetSession,
      terminalId,
      generation,
      text: '',
      seq: 0,
    }
    activeRef.current = active
    lastSizeRef.current = undefined
    terminal.reset()
    store.attach(targetSession, terminalId)
    const result = await webTerminal.readRaw({ sessionId: targetSession, terminalId })
    if (activeRef.current !== active) return
    if (!result.ok) {
      store.fail(targetSession, result.error.message)
      fitAndFocus()
      return
    }
    await new Promise<void>((resolve) => { terminal.write(result.value.text, resolve) })
    if (activeRef.current !== active) return
    active.text = result.value.text
    active.seq = result.value.seq ?? 0
    fitAndFocus()
  }, [fitAndFocus, store, webTerminal])

  const spawn = useCallback((target: SessionId): void => {
    setStarting(true)
    void webTerminal.spawn({ sessionId: target }).then(async (result) => {
      if (!result.ok) {
        store.fail(target, result.error.message)
        return
      }
      await attach(target, result.value.sessionId)
    }).catch((error: unknown) => { reportFailure(target, error) }).finally(() => { setStarting(false) })
  }, [attach, reportFailure, store, webTerminal])

  useEffect(() => {
    const mount = mountRef.current
    if (mount === null) return
    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      scrollback: 10_000,
      theme: terminalTheme(mount),
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.attachCustomKeyEventHandler((event) => {
      // Escape is both a core TUI key and a common application shortcut. Own
      // it inside xterm so parent workbench handlers cannot steal it from vi.
      if (event.type === 'keydown' && event.key === 'Escape') {
        enqueueInput('\x1b')
        return false
      }
      return true
    })
    terminal.open(mount)
    terminalRef.current = terminal
    fitRef.current = fit

    const data = terminal.onData((chunk) => {
      enqueueInput(chunk)
    })
    const resized = terminal.onResize(({ cols, rows }) => {
      const active = activeRef.current
      if (active === undefined || cols <= 0 || rows <= 0) return
      const last = lastSizeRef.current
      if (last?.terminalId === active.terminalId && last.cols === cols && last.rows === rows) return
      lastSizeRef.current = { terminalId: active.terminalId, cols, rows }
      void webTerminal.resize({ sessionId: active.sessionId, terminalId: active.terminalId, cols, rows })
        .then((result) => { if (!result.ok) store.fail(active.sessionId, result.error.message) })
        .catch((error: unknown) => { reportFailure(active.sessionId, error) })
    })
    const observer = new ResizeObserver(() => { fitAndFocus() })
    observer.observe(mount)
    fitAndFocus()

    return () => {
      observer.disconnect()
      data.dispose()
      resized.dispose()
      fit.dispose()
      terminal.dispose()
      terminalRef.current = undefined
      fitRef.current = undefined
      activeRef.current = undefined
    }
  }, [enqueueInput, fitAndFocus, reportFailure, store, webTerminal])

  useEffect(() => {
    let alive = true
    let reading = false
    const poll = (): void => {
      const active = activeRef.current
      const terminal = terminalRef.current
      if (!alive || reading || active === undefined || terminal === undefined) return
      reading = true
      void webTerminal.readRaw({ sessionId: active.sessionId, terminalId: active.terminalId })
        .then((result) => {
          if (!alive || activeRef.current !== active || !result.ok) {
            if (result !== undefined && !result.ok) store.fail(active.sessionId, result.error.message)
            return
          }
          const seq = result.value.seq ?? 0
          if (seq <= active.seq) return
          const next = result.value.text
          if (next.startsWith(active.text)) terminal.write(next.slice(active.text.length))
          else {
            terminal.reset()
            terminal.write(next)
          }
          active.text = next
          active.seq = seq
        })
        .catch((error: unknown) => { if (alive) reportFailure(active.sessionId, error) })
        .finally(() => { reading = false })
    }
    const timer = setInterval(poll, 80)
    return () => { alive = false; clearInterval(timer) }
  }, [reportFailure, store, webTerminal])

  useEffect(() => {
    activeRef.current = undefined
    generationRef.current += 1
    terminalRef.current?.reset()
    if (sessionId === undefined) return
    let alive = true
    void webTerminal.list({ sessionId }).then((result) => {
      if (!alive) return
      if (!result.ok) {
        store.fail(sessionId, result.error.message)
        return
      }
      const selected = result.value.at(-1)
      if (selected === undefined) spawn(sessionId)
      else void attach(sessionId, selected.sessionId)
    }).catch((error: unknown) => { if (alive) reportFailure(sessionId, error) })
    return () => { alive = false }
  }, [attach, reportFailure, sessionId, spawn, store, webTerminal])

  const label = useMemo(() => basename(cwd), [cwd])

  return (
    <section className={css.root} aria-label="Terminal">
      <header className={css.header}>
        <div className={css.tab}>
          <IconCodeOutline16 />
          <span>{label}</span>
        </div>
        <Tooltip label="New terminal" side="top" delayMs={400}>
          <button
            type="button"
            className={css.iconButton}
            aria-label="New terminal"
            disabled={sessionId === undefined || starting}
            onClick={() => { if (sessionId !== undefined) spawn(sessionId) }}
          >
            <IconPlusOutline16 />
          </button>
        </Tooltip>
        <span className={css.spacer} />
        <Tooltip label="Close terminal" side="top" delayMs={400}>
          <button type="button" className={css.iconButton} aria-label="Close terminal" onClick={() => { props.closePanel() }}>
            <IconCloseOutline16 />
          </button>
        </Tooltip>
      </header>

      <div
        className={css.canvas}
        role="application"
        aria-label="Terminal canvas"
        aria-busy={starting}
        onClick={() => { terminalRef.current?.focus() }}
      >
        <div ref={mountRef} className={css.mount} />
        {state.error !== undefined && <div className={css.error} role="status">{state.error}</div>}
      </div>
    </section>
  )
}
