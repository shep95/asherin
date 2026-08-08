/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta } from '../email-theme.tsx'

interface Props {
  name?: string
  device?: string
  browser?: string
  location?: string
  ipAddress?: string
  loginTime?: string
}

const NewLoginDetectedEmail = ({
  name,
  device = 'Unknown device',
  browser = 'Unknown browser',
  location = 'Unknown location',
  ipAddress,
  loginTime = new Date().toUTCString(),
}: Props) => (
  <Shell preview="A new sign-in to your account." eyebrow="Security">
    <Hed>New sign-in.</Hed>
    <Prose>
      {name ? `${name}, a` : 'A'} new session opened on your Asherin account.
      If this was you, no further action is needed.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Device', value: device },
        { label: 'Browser', value: browser },
        { label: 'Location', value: location },
        ...(ipAddress ? [{ label: 'IP', value: ipAddress }] : []),
        { label: 'Time', value: loginTime },
      ]}
    />
    <Prose>
      If you don't recognize this, secure the account and revoke active sessions now.
    </Prose>
    <Cta href="https://asherin.com/security" label="Secure account" />
  </Shell>
)

export const template = {
  component: NewLoginDetectedEmail,
  subject: 'New sign-in to your Asherin account',
  displayName: 'New login detected',
  previewData: {
    name: 'Asher',
    device: 'MacBook Pro',
    browser: 'Chrome 132',
    location: 'San Francisco, CA, US',
    ipAddress: '198.51.100.42',
    loginTime: 'Tue, 26 May 2026 22:14:00 GMT',
  },
} satisfies TemplateEntry
