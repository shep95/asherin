/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'
const SITE_URL = 'https://aureonai.app'

interface Props {
  name?: string
  resource?: string
  used?: number
  limit?: number
  percent?: number
  resetDate?: string
  planName?: string
}

const QuotaWarningEmail = ({
  name,
  resource = 'AI requests',
  used = 800,
  limit = 1000,
  percent,
  resetDate,
  planName = 'Aureon',
}: Props) => {
  const pct = percent ?? Math.round((used / Math.max(limit, 1)) * 100)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You've used {pct}% of your {resource}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>AUREON · USAGE</Text>
          <Heading style={h1}>{pct}% of {resource} used.</Heading>
          <Text style={text}>
            {name ? `${name}, your` : 'Your'} {planName} plan is at {pct}% of its monthly {resource} limit
            ({used.toLocaleString()} of {limit.toLocaleString()}).
          </Text>

          <Section style={barWrap}>
            <Section style={{ ...bar, width: `${Math.min(pct, 100)}%` }} />
          </Section>

          {resetDate && (
            <Text style={text}>Your quota resets on <strong>{resetDate}</strong>.</Text>
          )}

          <Text style={text}>
            To avoid interruption, consider upgrading your plan for higher limits.
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={`${SITE_URL}/pricing`} style={button}>Upgrade plan</Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>— The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: QuotaWarningEmail,
  subject: (d: Record<string, any>) => `You've used ${d?.percent ?? 80}% of your ${d?.resource ?? 'quota'}`,
  displayName: 'Quota warning',
  previewData: {
    name: 'Asher',
    resource: 'AI requests',
    used: 800,
    limit: 1000,
    percent: 80,
    resetDate: 'June 26, 2026',
    planName: 'Aureon Chat',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 20px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 16px' }
const barWrap = { backgroundColor: '#f0f0f0', borderRadius: '8px', height: '10px', margin: '8px 0 20px', overflow: 'hidden' as const }
const bar = { backgroundColor: '#0a0a0a', height: '10px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
