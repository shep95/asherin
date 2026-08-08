/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta } from '../email-theme.tsx'

interface Props {
  name?: string
  scheduledDeletionDate?: string
  cancelUrl?: string
}

const AccountDeletionScheduledEmail = ({
  name,
  scheduledDeletionDate = '30 days from now',
  cancelUrl = 'https://asherin.com/account',
}: Props) => (
  <Shell preview="Your account is scheduled for deletion." eyebrow="Account">
    <Hed>Deletion scheduled.</Hed>
    <Prose>
      {name ? `${name}, we've` : "We've"} received your request to delete your Asherin account.
    </Prose>
    <MetaCard rows={[{ label: 'Permanent deletion on', value: <strong>{scheduledDeletionDate}</strong> }]} />
    <Prose>
      On that date, conversations, intelligence files, and all associated data
      will be erased. This is final and irreversible.
    </Prose>
    <Prose>Changed your mind? Cancel any time before the deletion date.</Prose>
    <Cta href={cancelUrl} label="Cancel deletion" variant="ghost" />
  </Shell>
)

export const template = {
  component: AccountDeletionScheduledEmail,
  subject: 'Your Asherin account is scheduled for deletion',
  displayName: 'Account deletion scheduled',
  previewData: {
    name: 'Asher',
    scheduledDeletionDate: 'June 25, 2026',
    cancelUrl: 'https://asherin.com/account',
  },
} satisfies TemplateEntry
