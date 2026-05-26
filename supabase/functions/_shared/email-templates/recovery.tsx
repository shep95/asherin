/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Shell, Hed, Prose, Cta, Note } from '../email-theme.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Shell preview={`Reset your password for ${siteName}.`} eyebrow="Reset">
    <Hed>Reset your password.</Hed>
    <Prose>
      A password reset was requested for your <strong>{siteName}</strong> account.
      Confirm below to choose a new password.
    </Prose>
    <Cta href={confirmationUrl} label="Reset password" />
    <Note>Didn't request this? Ignore the email. Your current password remains active.</Note>
  </Shell>
)

export default RecoveryEmail
