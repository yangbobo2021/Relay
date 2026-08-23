import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Button,
  IconChevronRightOutline14,
  IconPlayOutline16,
  IconRefreshOutline16,
  IconTrashOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { RelayManagementLocaleKey } from './locales.ts'
import css from './WaitingEventsSection.module.css'

interface WaitView {
  wait_id: string
  status: string
  expected_event?: string
}

interface MonitorView {
  monitor_id: string
  state: string
  next_check_at: string | null
  last_observation: { observed_at?: string } | null
}

export interface RegistrationView {
  session_id: string
  task_summary: string
  updated_at: string
  waits: WaitView[]
  monitors: MonitorView[]
}

export interface ManagementSnapshot {
  registrations: RegistrationView[]
}

export interface WaitingEventsInjected {
  list: () => Promise<ManagementSnapshot>
  cancel: (sessionId: string) => Promise<void>
  runNow: (monitorId: string) => Promise<void>
  openSession: (sessionId: string) => void
  t: (key: RelayManagementLocaleKey, params?: Record<string, string | number>) => string
}

type WaitingEventsSectionProps = PropsRuntime<'settings.section'> & Partial<WaitingEventsInjected>

type ViewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; snapshot: ManagementSnapshot }

const ACTIVE_WAIT = new Set(['active', 'claimed'])
const RUNNABLE_MONITOR = new Set(['active', 'degraded'])

export function WaitingEventsSection(props: WaitingEventsSectionProps): ReactNode {
  const { list, cancel, runNow, openSession, t, close, useSessions } = props
  if (list === undefined || cancel === undefined || runNow === undefined
    || openSession === undefined || t === undefined) return null

  const sessionTitles = useSessions(state => state.byId)
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const [pending, setPending] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)

  const load = useCallback(() => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }, [])

  useEffect(() => {
    let current = true
    void list().then(
      snapshot => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const registrations = useMemo(
    () => state.status === 'ready' ? state.snapshot.registrations : [],
    [state],
  )

  const perform = async (key: string, operation: () => Promise<void>): Promise<void> => {
    setPending(key)
    setOperationError(null)
    try {
      await operation()
      setConfirming(null)
      load()
    } catch {
      setOperationError(t('operationError'))
    } finally {
      setPending(null)
    }
  }

  const open = (sessionId: string): void => {
    close()
    openSession(sessionId)
  }

  return (
    <section className={css.section} aria-busy={state.status === 'loading'}>
      <div className={css.toolbar}>
        <span className={css.total}>{registrations.length}</span>
        <Tooltip label={t('refresh')} side="bottom" delayMs={400}>
          <button className={css.iconButton} type="button" onClick={load} aria-label={t('refresh')}>
            <IconRefreshOutline16 />
          </button>
        </Tooltip>
      </div>

      {operationError !== null ? <p className={css.error} role="alert">{operationError}</p> : null}
      {state.status === 'loading' ? <p className={css.message}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('loadError')}</p>
          <Button size="sm" variant="outline" onClick={load}>{t('retry')}</Button>
        </div>
      ) : null}
      {state.status === 'ready' && registrations.length === 0
        ? <p className={css.empty}>{t('empty')}</p>
        : null}

      {registrations.length > 0 ? (
        <ul className={css.registrations}>
          {registrations.map((registration) => {
            const liveWaits = registration.waits.filter(wait => ACTIVE_WAIT.has(wait.status))
            const liveMonitors = registration.monitors.filter(monitor =>
              ['active', 'degraded', 'triggered'].includes(monitor.state))
            const title = sessionTitles[registration.session_id as SessionId]?.displayTitle ?? registration.task_summary
            const cancelKey = `cancel:${registration.session_id}`
            return (
              <li className={css.registration} key={registration.session_id}>
                <div className={css.registrationHeader}>
                  <button className={css.sessionButton} type="button" onClick={() => { open(registration.session_id) }}>
                    <span className={css.title}>{title}</span>
                    <IconChevronRightOutline14 aria-hidden="true" />
                  </button>
                  <span className={css.statusBadge}>{t('waiting')}</span>
                  <div className={css.actions}>
                    {confirming === registration.session_id ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending !== null}
                          onClick={() => { setConfirming(null) }}
                        >
                          {t('keep')}
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={pending !== null}
                          onClick={() => { void perform(cancelKey, () => cancel(registration.session_id)) }}
                        >
                          {t('confirmCancel')}
                        </Button>
                      </>
                    ) : (
                      <Tooltip label={t('cancel')} side="bottom" delayMs={400}>
                        <button
                          className={css.iconButton}
                          type="button"
                          disabled={pending !== null}
                          aria-label={t('cancel')}
                          onClick={() => { setConfirming(registration.session_id) }}
                        >
                          <IconTrashOutline16 />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <p className={css.summary}>{registration.task_summary}</p>
                <div className={css.counts}>
                  <span>{t('waitCount', { count: liveWaits.length })}</span>
                  <span>{t('monitorCount', { count: liveMonitors.length })}</span>
                </div>

                {liveWaits.length > 0 ? (
                  <ul className={css.waits}>
                    {liveWaits.map(wait => (
                      <li key={wait.wait_id}>
                        <span className={css.stateDot} data-state={wait.status} />
                        <span className={css.waitText}>{wait.expected_event ?? wait.wait_id}</span>
                        <span className={css.rowState}>{statusText(wait.status, t)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {liveMonitors.length > 0 ? (
                  <ul className={css.monitors}>
                    {liveMonitors.map(monitor => {
                      const runKey = `run:${monitor.monitor_id}`
                      const runnable = RUNNABLE_MONITOR.has(monitor.state)
                      return (
                        <li key={monitor.monitor_id}>
                          <div className={css.monitorMain}>
                            <span className={css.stateDot} data-state={monitor.state} />
                            <div className={css.monitorTimes}>
                              <span>{statusText(monitor.state, t)}</span>
                              <small>
                                {monitor.next_check_at === null
                                  ? t('noSchedule')
                                  : `${t('nextCheck')} ${formatTime(monitor.next_check_at)}`}
                                {monitor.last_observation?.observed_at === undefined
                                  ? ''
                                  : ` · ${t('lastCheck')} ${formatTime(monitor.last_observation.observed_at)}`}
                              </small>
                            </div>
                          </div>
                          <Tooltip label={t('runNow')} side="bottom" delayMs={400} disabled={!runnable}>
                            <button
                              className={css.iconButton}
                              type="button"
                              disabled={!runnable || pending !== null}
                              aria-label={t('runNow')}
                              onClick={() => { void perform(runKey, () => runNow(monitor.monitor_id)) }}
                            >
                              <IconPlayOutline16 />
                            </button>
                          </Tooltip>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

function statusText(
  status: string,
  t: WaitingEventsInjected['t'],
): string {
  const known = new Set<RelayManagementLocaleKey>([
    'active', 'claimed', 'degraded', 'triggered', 'failed', 'completed', 'cancelled',
  ])
  return known.has(status as RelayManagementLocaleKey)
    ? t(status as RelayManagementLocaleKey)
    : status
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
