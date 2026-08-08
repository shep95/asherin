/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note } from '../email-theme.tsx'

interface Props {
  name?: string
  planName?: string
  amount?: string
  reason?: string
  nextAttempt?: string
}

const PaymentFailedEmail = ({ name, planName = 'Asherin', amount, reason, nextAttempt }: Props) => (
  <Shell preview="Payment did not go through." eyebrow="Billing">
    <Hed>Payment failed.</Hed>
    <Prose>
      {name ? `${name}, we` : 'We'} couldn't process your most recent payment for {planName}.
      Service continues for now — update your payment method to avoid interruption.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Plan', value: planName },
        ...(amount ? [{ label: 'Amount', value: amount }] : []),
        ...(reason ? [{ label: 'Reason', value: reason }] : []),
        ...(nextAttempt ? [{ label: 'Next attempt', value: nextAttempt }] : []),
      ]}
    />
    <Cta href="https://asherin.com/account/billing" label="Update payment method" />
    <Note>If you've already resolved this with your bank, you can ignore this message.</Note>
  </Shell>
)

export const template = {
  component: PaymentFailedEmail,
  subject: 'Payment failed — action required',
  displayName: 'Payment failed',
  previewData: { name: 'Asher', planName: 'Asherin Pro', amount: '$740.00', reason: 'Card declined', nextAttempt: 'May 29, 2026' },
} satisfies TemplateEntry
