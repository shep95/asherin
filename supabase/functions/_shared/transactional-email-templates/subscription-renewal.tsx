/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'
const MANAGE_URL = 'https://aureonai.app/account'

interface Props {
  name?: string
  planName?: string
  renewalDate?: string
  amount?: string
}

const SubscriptionRenewalEmail = ({ name, planName, renewalDate, amount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {planName ?? SITE_NAME} subscription renews soon</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · SUBSCRIPTION</Text>
        <Heading style={h1}>Renewal notice.</Heading>
        <Text style={text}>
          {name ? `${name}, this` : 'This'} is a heads up — your {planName ?? 'subscription'} renews
          on <strong style={strong}>{renewalDate ?? 'your next billing date'}</strong> for{' '}
          <strong style={strong}>{amount ?? 'your standard rate'}</strong>.
        </Text>
        <Text style={text}>
          No action is required. Your access continues uninterrupted. If you
          want to make changes, you can manage your subscription anytime.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={MANAGE_URL} style={button}>Manage Subscription</Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionRenewalEmail,
  subject: (d: any) => `Your ${d?.planName ?? SITE_NAME} subscription renews ${d?.renewalDate ?? 'soon'}`,
  displayName: 'Subscription Renewal',
  previewData: { name: 'Asher', planName: 'Aureon Pro', renewalDate: 'June 26, 2026', amount: '$740.00 USD' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const strong = { color: '#0a0a0a', fontWeight: 600 as const }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
