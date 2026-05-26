/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'

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
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Receipt for {planName} — {amount}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON</Text>
        <Heading style={h1}>Payment received.</Heading>
        <Text style={text}>
          {name ? `Thanks, ${name}. ` : 'Thank you. '}
          Your payment has been processed successfully.
        </Text>

        <Section style={card}>
          <Row><Column style={lbl}>Invoice</Column><Column style={val}>{invoiceNumber}</Column></Row>
          <Row><Column style={lbl}>Plan</Column><Column style={val}>{planName}</Column></Row>
          <Row><Column style={lbl}>Amount</Column><Column style={val}>{amount}</Column></Row>
          <Row><Column style={lbl}>Paid</Column><Column style={val}>{paidAt}</Column></Row>
          {last4 && <Row><Column style={lbl}>Card</Column><Column style={val}>•••• {last4}</Column></Row>}
          {nextBillingDate && <Row><Column style={lbl}>Next bill</Column><Column style={val}>{nextBillingDate}</Column></Row>}
        </Section>

        <Hr style={hr} />
        <Text style={small}>Keep this receipt for your records. Reply with any billing questions.</Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
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

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 20px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 24px' }
const card = { backgroundColor: '#f7f7f7', border: '1px solid #eee', borderRadius: '10px', padding: '20px 24px', margin: '0 0 24px' }
const lbl = { fontSize: '13px', color: '#777', padding: '6px 0', width: '40%' }
const val = { fontSize: '14px', color: '#0a0a0a', padding: '6px 0', fontWeight: 500 as const, textAlign: 'right' as const }
const hr = { borderColor: '#eee', margin: '24px 0' }
const small = { fontSize: '13px', color: '#666', margin: '0 0 8px' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
