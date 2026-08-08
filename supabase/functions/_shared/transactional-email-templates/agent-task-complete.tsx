/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note } from '../email-theme.tsx'

interface Props {
  name?: string
  agentName?: string
  taskName?: string
  summary?: string
  resultUrl?: string
  completedAt?: string
  durationMs?: number
}

const AgentTaskCompleteEmail = ({
  name,
  agentName = 'Zophiel Agent',
  taskName = 'Scheduled task',
  summary,
  resultUrl,
  completedAt = new Date().toUTCString(),
  durationMs,
}: Props) => (
  <Shell preview={`${agentName} finished: ${taskName}`} eyebrow="Agents">
    <Hed>Task complete.</Hed>
    <Prose>
      {name ? `${name}, ${agentName}` : agentName} finished <strong>{taskName}</strong>.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Agent', value: agentName },
        { label: 'Task', value: taskName },
        { label: 'Completed', value: completedAt },
        ...(typeof durationMs === 'number' ? [{ label: 'Duration', value: `${(durationMs / 1000).toFixed(1)}s` }] : []),
      ]}
    />
    {summary && <Prose>{summary}</Prose>}
    {resultUrl && <Cta href={resultUrl} label="View results" />}
    <Note>Adjust this agent's notification preferences from the dashboard.</Note>
  </Shell>
)

export const template = {
  component: AgentTaskCompleteEmail,
  subject: (d: Record<string, any>) => `${d?.agentName ?? 'Agent'} finished: ${d?.taskName ?? 'task'}`,
  displayName: 'Agent task complete',
  previewData: {
    name: 'Asher',
    agentName: 'Zophiel OSINT Scout',
    taskName: 'Weekly threat intelligence sweep',
    summary: 'Scanned 30 sources. Surfaced 4 high-confidence leads and 12 secondary signals across monitored entities.',
    resultUrl: 'https://asherin.com/agents/runs/latest',
    completedAt: 'Tue, 26 May 2026 22:14:00 GMT',
    durationMs: 47200,
  },
} satisfies TemplateEntry
