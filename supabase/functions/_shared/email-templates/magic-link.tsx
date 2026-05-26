/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Shell, Hed, Prose, Cta, Note } from '../email-theme.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Shell preview={`Your sign-in link for ${siteName}.`} eyebrow="Sign in">
    <Hed>Your sign-in link.</Hed>
    <Prose>
      One tap signs you into <strong>{siteName}</strong>. The link expires shortly
      and can only be used once.
    </Prose>
    <Cta href={confirmationUrl} label="Sign in" />
    <Note>Didn't request this? Ignore the email — no action will be taken.</Note>
  </Shell>
)

export default MagicLinkEmail
