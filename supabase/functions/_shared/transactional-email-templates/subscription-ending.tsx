/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, A, Note } from '../email-theme.tsx'

// ── Asher / #houseofasher social links ───────────────────────────────────────
// Keep in sync with subscription-welcome.tsx.
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
  endsOn?: string
}

const SubscriptionEndingEmail = ({ name, planName = 'Asherin', daysLeft = 3, endsOn }: Props) => (
  <Shell
    preview={`Your ${planName} subscription ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
    eyebrow="Subscription Ending Soon"
  >
    <Hed>
      {name ? `${name}, your ` : 'Your '}{planName} ends in {daysLeft} day{daysLeft === 1 ? '' : 's'}.
    </Hed>
    <Prose>
      We wanted to give you a heads-up — your <strong>{planName}</strong>{' '}
      subscription is set to end{endsOn ? ` on ${endsOn}` : ' soon'}.
    </Prose>
    <Prose>
      Thank you, sincerely, for the support you've already given. It means more
      than you know. We'd be honored if you stayed subscribed and kept building
      with us — but if this is where our paths part for now, we wish you nothing
      but love.
    </Prose>

    <MetaCard
      rows={[
        { label: 'Plan', value: planName },
        { label: 'Days remaining', value: `${daysLeft} day${daysLeft === 1 ? '' : 's'}` },
        ...(endsOn ? [{ label: 'Ends on', value: endsOn }] : []),
      ]}
    />

    <Cta href="https://asherin.com/dashboard/settings" label="Manage subscription" />

    <Prose>
      Either way — keep in touch. Follow Asher &amp; #houseofasher:
    </Prose>
    <Prose>
      <A href={SOCIALS.x}>X / Twitter</A> &nbsp;·&nbsp;{' '}
      <A href={SOCIALS.instagram}>Instagram</A> &nbsp;·&nbsp;{' '}
      <A href={SOCIALS.youtube}>YouTube</A> &nbsp;·&nbsp;{' '}
      <A href={SOCIALS.tiktok}>TikTok</A>
    </Prose>

    <Note>
      Nothing but love. — <em>#houseofasher and the Asherin Team</em>
    </Note>
  </Shell>
)

export const template = {
  component: SubscriptionEndingEmail,
  subject: (d: any) =>
    `Your ${d?.planName ?? 'Asherin'} subscription ends in ${d?.daysLeft ?? 3} day${(d?.daysLeft ?? 3) === 1 ? '' : 's'}`,
  displayName: 'Subscription ending soon',
  previewData: {
    name: 'Asher',
    planName: 'Asherin Pro',
    daysLeft: 3,
    endsOn: 'June 22, 2026',
  },
} satisfies TemplateEntry
