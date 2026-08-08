/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, Cta, A } from '../email-theme.tsx'

interface Props { name?: string }

const WelcomeEmail = ({ name }: Props) => (
  <Shell preview="You're in. Asherin is active." eyebrow="Welcome">
    <Hed>{name ? `Welcome, ${name}.` : 'Welcome.'}</Hed>
    <Prose>
      Your access to Asherin is live. The platform is built for clarity, depth,
      and signal — nothing else.
    </Prose>
    <Prose>
      Open the workspace when you're ready. Everything you need is one keystroke away.
    </Prose>
    <Cta href="https://asherin.com" label="Open Asherin" />
    <Prose>
      Questions are welcome. Reply to this message and a human reads it.
      For documentation, see <A href="https://asherin.com/docs">asherin.com/docs</A>.
    </Prose>
  </Shell>
)

export const template = {
  component: WelcomeEmail,
  subject: 'You’re in.',
  displayName: 'Welcome',
  previewData: { name: 'Asher' },
} satisfies TemplateEntry
