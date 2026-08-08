/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, Cta } from '../email-theme.tsx'

interface Props { name?: string; changedAt?: string }

const PasswordChangedEmail = ({ name, changedAt = new Date().toUTCString() }: Props) => (
  <Shell preview="Your password was changed." eyebrow="Security">
    <Hed>Password updated.</Hed>
    <Prose>
      {name ? `${name}, your` : 'Your'} Asherin password was changed on {changedAt}.
    </Prose>
    <Prose>
      If you made this change, you're done. If you didn't, treat the account as
      compromised and secure it now.
    </Prose>
    <Cta href="https://asherin.com/security" label="Secure account" />
  </Shell>
)

export const template = {
  component: PasswordChangedEmail,
  subject: 'Your Asherin password was changed',
  displayName: 'Password changed',
  previewData: { name: 'Asher', changedAt: 'Tue, 26 May 2026 22:14:00 GMT' },
} satisfies TemplateEntry
