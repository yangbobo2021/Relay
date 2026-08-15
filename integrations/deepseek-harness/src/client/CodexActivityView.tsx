import { memo, useState } from 'react'
import {
  DisclosureRow,
  IconCodeOutline16,
  IconListPenOutline16,
  IconSearchOutline16,
  StateDot,
  type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CodexActivityData } from './codex-activity.ts'
import css from './CodexActivityView.module.css'

type CodexActivityViewProps = PropsRuntime<'conversation.chat.node', 'relay-codex-activity'>

function dotState(status: CodexActivityData['status']): StateDotState {
  if (status === 'running') return 'ongoing'
  if (status === 'error') return 'error'
  return 'done'
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'webSearch') return <IconSearchOutline16 />
  if (type === 'plan') return <IconListPenOutline16 />
  return <IconCodeOutline16 />
}

export const CodexActivityView = memo(function CodexActivityView({ node }: CodexActivityViewProps) {
  const activity = node.data as CodexActivityData
  const [open, setOpen] = useState(false)
  const expandable = activity.input !== undefined || activity.output !== undefined || activity.provenance !== undefined
  return (
    <div className={css.activity} data-codex-activity={activity.type}>
      <DisclosureRow
        icon={<ActivityIcon type={activity.type} />}
        title={activity.title}
        open={open}
        expandable={expandable}
        onToggle={() => { setOpen(value => !value) }}
        expandOnRowClick
        collapsedContent={(
          <span className={css.summary}>
            <span>{activity.summary}</span>
            <StateDot state={dotState(activity.status)} size={8} />
          </span>
        )}
      >
        <div className={css.detail}>
          {activity.provenance !== undefined ? (
            <div
              className={css.provenance}
              title={`Codex App Server · Thread ${activity.provenance.threadId} · Turn ${activity.provenance.turnId}`}
            >
              Codex App Server · Thread {shortId(activity.provenance.threadId)} · Turn {shortId(activity.provenance.turnId)}
            </div>
          ) : null}
          {activity.input !== undefined ? <pre>{activity.input}</pre> : null}
          {activity.output !== undefined ? <pre>{activity.output}</pre> : null}
        </div>
      </DisclosureRow>
    </div>
  )
})

function shortId(value: string): string {
  return value.length > 15 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}
