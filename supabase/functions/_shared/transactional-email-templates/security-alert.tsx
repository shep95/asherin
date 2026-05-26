/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'
const SECURE_URL = 'https://aureonai.app/account/security'

interface Props {
  name?: string
  event?: string
  device?: string
  location?: string
  ipAddress?: string
  time?: string
}

const SecurityAlertEmail = ({ name, event, device, location, ipAddress, time }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Security alert on your {SITE_NAME} account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · SECURITY</Text>
        <Heading style={h1}>{event ?? 'Security activity detected.'}</Heading>
        <Text style={text}>
          {name ? `${name}, we` : 'We'} detected activity on your account. If this was you,
          no action is needed. If you don't recognize it, secure your account immediately.
        </Text>
        <Section style={card}>
          <Row><Column style={label}>Event</Column><Column style={value}>{event ?? 'Sign-in'}</Column></Row>
          <Hr style={innerHr} />
          <Row><Column style={label}>Device</Column><Column style={value}>{device ?? 'Unknown device'}</Column></Row>
          <Hr style={innerHr} />
          <Row><Column style={label}>Location</Column><Column style={value}>{location ?? 'Unknown'}</Column></Row>
          <Hr style={innerHr} />
          <Row><Column style={label}>IP</Column><Column style={value}>{ipAddress ?? '—'}</Column></Row>
          <Hr style={innerHr} />
          <Row><Column style={label}>Time</Column><Column style={value}>{time ?? '—'}</Column></Row>
        </Section>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={SECURE_URL} style={button}>Review Activity</Button>
        </Section>
        <Text style={small}>
          If this wasn't you, change your password and enable two-factor
          authentication right away.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Security Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SecurityAlertEmail,
  subject: (d: any) => `Security alert: ${d?.event ?? 'new activity on your account'}`,
  displayName: 'Security Alert',
  previewData: {
    name: 'Asher', event: 'New sign-in', device: 'Chrome on macOS',
    location: 'New York, NY', ipAddress: '192.168.1.1', time: 'May 26, 2026 · 14:32 UTC',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '26px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 24px' }
const card = { backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '20px 24px', margin: '0 0 24px' }
const label = { fontSize: '13px', color: '#888', padding: '8px 0' }
const value = { fontSize: '14px', color: '#0a0a0a', fontWeight: 500 as const, textAlign: 'right' as const, padding: '8px 0' }
const innerHr = { borderColor: '#eee', margin: '0' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const small = { fontSize: '13px', color: '#666', margin: '0 0 8px', lineHeight: '1.5' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
