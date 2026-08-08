/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta } from '../email-theme.tsx'

interface Props {
  name?: string
  event?: string
  device?: string
  location?: string
  time?: string
}

const SecurityAlertEmail = ({ name, event = 'Account activity detected', device, location, time }: Props) => (
  <Shell preview={event} eyebrow="Security">
    <Hed>{event}.</Hed>
    <Prose>
      {name ? `${name}, we` : 'We'} flagged activity on your account. If this was you, no action is needed.
    </Prose>
    <MetaCard
      rows={[
        ...(device ? [{ label: 'Device', value: device }] : []),
        ...(location ? [{ label: 'Location', value: location }] : []),
        ...(time ? [{ label: 'Time', value: time }] : []),
      ]}
    />
    <Prose>
      Wasn't you? Lock the account and rotate credentials immediately.
    </Prose>
    <Cta href="https://asherin.com/security" label="Secure account" />
  </Shell>
)

export const template = {
  component: SecurityAlertEmail,
  subject: (d: any) => d?.event ?? 'Security alert on your Asherin account',
  displayName: 'Security alert',
  previewData: { name: 'Asher', event: 'New device signed in', device: 'MacBook Pro · Chrome', location: 'San Francisco, CA, US', time: 'May 26, 2026 · 22:14 UTC' },
} satisfies TemplateEntry
