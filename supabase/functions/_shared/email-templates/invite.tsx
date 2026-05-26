/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Shell, Hed, Prose, Cta, Note, A } from '../email-theme.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Shell preview={`You've been invited to ${siteName}.`} eyebrow="Invitation">
    <Hed>You're invited.</Hed>
    <Prose>
      You have been invited to <A href={siteUrl}>{siteName}</A>. Accept the
      invitation to set up your account.
    </Prose>
    <Cta href={confirmationUrl} label="Accept invitation" />
    <Note>Not expecting this? Ignore the email — no account will be created.</Note>
  </Shell>
)

export default InviteEmail
