/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note } from '../email-theme.tsx'

interface Props {
  name?: string
  planName?: string
  amount?: string
  renewalDate?: string
  last4?: string
}

const SubscriptionRenewalEmail = ({ name, planName = 'Asherin', amount, renewalDate, last4 }: Props) => (
  <Shell preview={`${planName} renews ${renewalDate ?? 'soon'}.`} eyebrow="Renewal">
    <Hed>{planName} renews soon.</Hed>
    <Prose>
      {name ? `${name}, this` : 'This'} is a heads-up. Your subscription will renew
      automatically — no action required.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Plan', value: planName },
        { label: 'Amount', value: amount ?? '—' },
        { label: 'Renewal date', value: renewalDate ?? '—' },
        ...(last4 ? [{ label: 'Card', value: `•••• ${last4}` }] : []),
      ]}
    />
    <Cta href="https://asherin.com/account/billing" label="Manage subscription" variant="ghost" />
    <Note>You can cancel or change plan anytime before the renewal date.</Note>
  </Shell>
)

export const template = {
  component: SubscriptionRenewalEmail,
  subject: (d: any) => `${d?.planName ?? 'Asherin'} renews ${d?.renewalDate ?? 'soon'}`,
  displayName: 'Subscription renewal',
  previewData: { name: 'Asher', planName: 'Asherin Pro', amount: '$740.00', renewalDate: 'June 26, 2026', last4: '4242' },
} satisfies TemplateEntry
