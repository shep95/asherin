/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Note, Cta, Soft } from '../email-theme.tsx'

interface Props {
  name?: string
  planName?: string
  amount?: string
  invoiceNumber?: string
  paidAt?: string
  nextBillingDate?: string
  last4?: string
  /** Stripe hosted invoice page URL (HTML view, recommended) */
  receiptUrl?: string
  /** Stripe-hosted invoice PDF (direct download) */
  invoicePdfUrl?: string
}

const InvoiceReceiptEmail = ({
  name,
  planName = 'Asherin',
  amount = '$199.00',
  invoiceNumber = 'INV-000000',
  paidAt = new Date().toISOString().slice(0, 10),
  nextBillingDate,
  last4,
  receiptUrl,
  invoicePdfUrl,
}: Props) => {
  const primaryHref = invoicePdfUrl || receiptUrl
  const secondaryHref = invoicePdfUrl && receiptUrl ? receiptUrl : undefined

  return (
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

      {primaryHref && (
        <Cta
          href={primaryHref}
          label={invoicePdfUrl ? 'Download receipt (PDF)' : 'View receipt'}
        />
      )}
      {secondaryHref && (
        <Cta href={secondaryHref} label="View receipt online" variant="ghost" />
      )}

      <Note>Keep this email for your records.</Note>
      {(receiptUrl || invoicePdfUrl) && (
        <Soft>Past receipts are also available anytime under Subscription → Receipts.</Soft>
      )}
    </Shell>
  )
}

export const template = {
  component: InvoiceReceiptEmail,
  subject: (d: Record<string, any>) => `Receipt — ${d?.planName ?? 'Asherin'} (${d?.amount ?? ''})`.trim(),
  displayName: 'Invoice receipt',
  previewData: {
    name: 'Asher',
    planName: 'Asherin Pro',
    amount: '$740.00',
    invoiceNumber: 'INV-2026-0142',
    paidAt: '2026-05-26',
    nextBillingDate: '2026-06-26',
    last4: '4242',
    receiptUrl: 'https://invoice.stripe.com/i/acct_xxx/test_yyy',
    invoicePdfUrl: 'https://pay.stripe.com/invoice/acct_xxx/test_yyy/pdf',
  },
} satisfies TemplateEntry
