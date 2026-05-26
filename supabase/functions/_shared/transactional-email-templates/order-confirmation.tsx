/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'

interface Props {
  name?: string
  orderId?: string
  planName?: string
  amount?: string
  date?: string
}

const OrderConfirmationEmail = ({ name, orderId, planName, amount, date }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Order confirmed — {planName ?? 'your plan'} is active</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · RECEIPT</Text>
        <Heading style={h1}>Order confirmed.</Heading>
        <Text style={text}>
          {name ? `${name}, thank you` : 'Thank you'} for your purchase. Your
          access is active immediately.
        </Text>
        <Section style={card}>
          <Row><Column style={label}>Order</Column><Column style={value}>{orderId ?? '—'}</Column></Row>
          <Hr style={innerHr} />
          <Row><Column style={label}>Plan</Column><Column style={value}>{planName ?? '—'}</Column></Row>
          <Hr style={innerHr} />
          <Row><Column style={label}>Amount</Column><Column style={value}>{amount ?? '—'}</Column></Row>
          <Hr style={innerHr} />
          <Row><Column style={label}>Date</Column><Column style={value}>{date ?? '—'}</Column></Row>
        </Section>
        <Text style={small}>This email serves as your receipt. Keep it for your records.</Text>
        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (d: any) => `Order confirmed — ${d?.planName ?? SITE_NAME}`,
  displayName: 'Order Confirmation',
  previewData: { name: 'Asher', orderId: 'ORD-7H3F2K', planName: 'Aureon Pro', amount: '$740.00 USD', date: 'May 26, 2026' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 24px' }
const card = { backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '20px 24px', margin: '0 0 24px' }
const label = { fontSize: '13px', color: '#888', padding: '8px 0' }
const value = { fontSize: '14px', color: '#0a0a0a', fontWeight: 500 as const, textAlign: 'right' as const, padding: '8px 0' }
const innerHr = { borderColor: '#eee', margin: '0' }
const small = { fontSize: '13px', color: '#666', margin: '0 0 8px' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
