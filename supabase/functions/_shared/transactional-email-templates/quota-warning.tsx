/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, Bar, Cta, Note } from '../email-theme.tsx'

interface Props {
  name?: string
  resource?: string
  used?: number
  limit?: number
  percent?: number
  resetDate?: string
  planName?: string
}

const QuotaWarningEmail = ({
  name,
  resource = 'AI requests',
  used = 800,
  limit = 1000,
  percent,
  resetDate,
  planName = 'Asherin',
}: Props) => {
  const pct = percent ?? Math.round((used / Math.max(limit, 1)) * 100)
  return (
    <Shell preview={`${pct}% of ${resource} used.`} eyebrow="Usage">
      <Hed>{pct}% used.</Hed>
      <Prose>
        {name ? `${name}, your` : 'Your'} {planName} plan is at {pct}% of its monthly
        {' '}{resource} limit — {used.toLocaleString()} of {limit.toLocaleString()}.
      </Prose>
      <Bar percent={pct} />
      {resetDate && <Prose>Quota resets on <strong>{resetDate}</strong>.</Prose>}
      <Prose>Upgrade now to keep momentum and avoid interruption.</Prose>
      <Cta href="https://asherin.com/pricing" label="Upgrade plan" />
      <Note>You can also downgrade or pause from your dashboard at any time.</Note>
    </Shell>
  )
}

export const template = {
  component: QuotaWarningEmail,
  subject: (d: Record<string, any>) => `${d?.percent ?? 80}% of your ${d?.resource ?? 'quota'} used`,
  displayName: 'Quota warning',
  previewData: {
    name: 'Asher',
    resource: 'AI requests',
    used: 800,
    limit: 1000,
    percent: 80,
    resetDate: 'June 26, 2026',
    planName: 'Asherin Chat',
  },
} satisfies TemplateEntry
