/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Shell, Hed, Prose, Cta, Note, A } from '../email-theme.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Shell preview={`Confirm your email for ${siteName}.`} eyebrow="Verify">
    <Hed>Confirm your email.</Hed>
    <Prose>
      You're one step away from <A href={siteUrl}>{siteName}</A>. Confirm{' '}
      <strong>{recipient}</strong> to activate your account.
    </Prose>
    <Cta href={confirmationUrl} label="Verify email" />
    <Note>If you didn't create this account, ignore this message — nothing happens without confirmation.</Note>
  </Shell>
)

export default SignupEmail
