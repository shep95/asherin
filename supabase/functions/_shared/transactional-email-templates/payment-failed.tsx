/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'
const BILLING_URL = 'https://aureonai.app/account/billing'

interface Props {
  name?: string
  planName?: string
  amount?: string
  retryDate?: string
}

const PaymentFailedEmail = ({ name, planName, amount, retryDate }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Action required — payment failed for your {SITE_NAME} subscription</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · BILLING</Text>
        <Heading style={h1}>Payment didn't go through.</Heading>
        <Text style={text}>
          {name ? `${name}, we` : 'We'} weren't able to charge your payment method for{' '}
          <strong style={strong}>{planName ?? 'your subscription'}</strong>
          {amount ? ` (${amount})` : ''}. Your access remains active for now.
        </Text>
        <Text style={text}>
          We'll automatically try again on{' '}
          <strong style={strong}>{retryDate ?? 'the next billing cycle'}</strong>. To avoid
          any interruption, update your payment method now.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={BILLING_URL} style={button}>Update Payment Method</Button>
        </Section>
        <Hr style={hr} />
        <Text style={small}>
          Need help? Reply to this email and we'll sort it out.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentFailedEmail,
  subject: 'Action required — payment failed',
  displayName: 'Payment Failed',
  previewData: { name: 'Asher', planName: 'Aureon Pro', amount: '$740.00 USD', retryDate: 'May 29, 2026' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const strong = { color: '#0a0a0a', fontWeight: 600 as const }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const small = { fontSize: '13px', color: '#666', margin: '0 0 8px' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
