/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Note } from '../email-theme.tsx'

interface Props {
  name?: string
  orderId?: string
  planName?: string
  amount?: string
  date?: string
}

const OrderConfirmationEmail = ({ name, orderId, planName, amount, date }: Props) => (
  <Shell preview={`Order confirmed — ${planName ?? 'Asherin'}.`} eyebrow="Receipt">
    <Hed>Order confirmed.</Hed>
    <Prose>
      {name ? `${name}, your` : 'Your'} purchase is complete. Access is active immediately.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Order', value: orderId ?? '—' },
        { label: 'Plan', value: planName ?? '—' },
        { label: 'Amount', value: amount ?? '—' },
        { label: 'Date', value: date ?? '—' },
      ]}
    />
    <Note>Retain this email as your receipt.</Note>
  </Shell>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (d: any) => `Order confirmed — ${d?.planName ?? 'Asherin'}`,
  displayName: 'Order confirmation',
  previewData: { name: 'Asher', orderId: 'ORD-7H3F2K', planName: 'Asherin Pro', amount: '$740.00 USD', date: 'May 26, 2026' },
} satisfies TemplateEntry
