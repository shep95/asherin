/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Shell, Hed, Prose, MetaCard, Cta } from '../email-theme.tsx'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Shell preview={`Confirm your email change for ${siteName}.`} eyebrow="Email change">
    <Hed>Confirm the change.</Hed>
    <Prose>You requested to update the email address on your {siteName} account.</Prose>
    <MetaCard
      rows={[
        { label: 'From', value: oldEmail },
        { label: 'To', value: newEmail },
      ]}
    />
    <Cta href={confirmationUrl} label="Confirm email change" />
    <Prose>
      If you didn't request this, treat your account as compromised and secure it now.
    </Prose>
  </Shell>
)

export default EmailChangeEmail
