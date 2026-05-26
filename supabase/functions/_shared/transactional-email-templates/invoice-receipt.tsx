/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Note } from '../email-theme.tsx'

interface Props {
  name?: string
  planName?: string
  amount?: string
  invoiceNumber?: string
  paidAt?: string
  nextBillingDate?: string
  last4?: string
}

const InvoiceReceiptEmail = ({
  name,
  planName = 'Aureon',
  amount = '$199.00',
  invoiceNumber = 'INV-000000',
  paidAt = new Date().toISOString().slice(0, 10),
  nextBillingDate,
  last4,
}: Props) => (
  <Shell preview={`Receipt — ${planName} · ${amount}`} eyebrow="Receipt">
    <Hed>Payment received.</Hed>
    <Prose>
      {name ? `Thank you, ${name}. ` : 'Thank you. '}Your payment cleared.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Invoice', value: invoiceNumber },
        { label: 'Plan', value: planName },
        { label: 'Amount', value: amount },
        { label: 'Paid', value: paidAt },
        ...(last4 ? [{ label: 'Card', value: `•••• ${last4}` }] : []),
        ...(nextBillingDate ? [{ label: 'Next bill', value: nextBillingDate }] : []),
      ]}
    />
    <Note>Keep this email for your records.</Note>
  </Shell>
)

export const template = {
  component: InvoiceReceiptEmail,
  subject: (d: Record<string, any>) => `Receipt — ${d?.planName ?? 'Aureon'} (${d?.amount ?? ''})`.trim(),
  displayName: 'Invoice receipt',
  previewData: {
    name: 'Asher',
    planName: 'Aureon Pro',
    amount: '$740.00',
    invoiceNumber: 'INV-2026-0142',
    paidAt: '2026-05-26',
    nextBillingDate: '2026-06-26',
    last4: '4242',
  },
} satisfies TemplateEntry
