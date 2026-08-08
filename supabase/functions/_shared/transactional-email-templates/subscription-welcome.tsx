/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, A, Note } from '../email-theme.tsx'

// ── Asher / #houseofasher social links ───────────────────────────────────────
// Edit these URLs to point to the real handles. They appear in every
// subscription email so subscribers can follow Asher across platforms.
const SOCIALS = {
  x:         'https://x.com/houseofasher',
  instagram: 'https://instagram.com/houseofasher',
  youtube:   'https://youtube.com/@houseofasher',
  tiktok:    'https://tiktok.com/@houseofasher',
}

interface Props {
  name?: string
  planName?: string
  daysLeft?: number
  renewalDate?: string
}

const SubscriptionWelcomeEmail = ({ name, planName = 'Asherin', daysLeft, renewalDate }: Props) => (
  <Shell
    preview={`Thank you for subscribing to ${planName}.`}
    eyebrow="Subscription Active"
  >
    <Hed>{name ? `Thank you, ${name}.` : 'Thank you for your support.'}</Hed>
    <Prose>
      Your <strong>{planName}</strong> subscription is live. Asherin was built for
      operators who want clarity, depth, and signal — and your support is what
      keeps the lights on inside the lab.
    </Prose>

    <MetaCard
      rows={[
        { label: 'Plan', value: planName },
        ...(typeof daysLeft === 'number'
          ? [{ label: 'Days remaining', value: `${daysLeft} day${daysLeft === 1 ? '' : 's'}` }]
          : []),
        ...(renewalDate ? [{ label: 'Renews / Ends', value: renewalDate }] : []),
      ]}
    />

    <Cta href="https://asherin.com/dashboard" label="Open Asherin" />

    <Prose>
      <strong>Follow Asher &amp; #houseofasher.</strong> Behind-the-scenes
      builds, intel drops, and the long-form thinking that powers Asherin — all
      first on his channels:
    </Prose>
    <Prose>
      <A href={SOCIALS.x}>X / Twitter</A> &nbsp;·&nbsp;{' '}
      <A href={SOCIALS.instagram}>Instagram</A> &nbsp;·&nbsp;{' '}
      <A href={SOCIALS.youtube}>YouTube</A> &nbsp;·&nbsp;{' '}
      <A href={SOCIALS.tiktok}>TikTok</A>
    </Prose>

    <Note>
      Reply to this email anytime — a human reads every message. — <em>Asher &amp; the Asherin Team · #houseofasher</em>
    </Note>
  </Shell>
)

export const template = {
  component: SubscriptionWelcomeEmail,
  subject: (d: any) => `Thank you for subscribing to ${d?.planName ?? 'Asherin'}`,
  displayName: 'Subscription welcome',
  previewData: {
    name: 'Asher',
    planName: 'Asherin Pro',
    daysLeft: 30,
    renewalDate: 'July 19, 2026',
  },
} satisfies TemplateEntry
