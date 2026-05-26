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
  device?: string
  browser?: string
  location?: string
  ipAddress?: string
  loginTime?: string
}

const NewLoginDetectedEmail = ({
  name,
  device = 'Unknown device',
  browser = 'Unknown browser',
  location = 'Unknown location',
  ipAddress,
  loginTime = new Date().toUTCString(),
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New sign-in to your {SITE_NAME} account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · SECURITY</Text>
        <Heading style={h1}>New sign-in detected.</Heading>
        <Text style={text}>
          {name ? `${name}, we` : 'We'} noticed a new sign-in to your {SITE_NAME} account.
          If this was you, no action is needed.
        </Text>

        <Section style={card}>
          <Text style={row}><span style={lbl}>Device</span><span style={val}>{device}</span></Text>
          <Text style={row}><span style={lbl}>Browser</span><span style={val}>{browser}</span></Text>
          <Text style={row}><span style={lbl}>Location</span><span style={val}>{location}</span></Text>
          {ipAddress && <Text style={row}><span style={lbl}>IP</span><span style={val}>{ipAddress}</span></Text>}
          <Text style={row}><span style={lbl}>Time</span><span style={val}>{loginTime}</span></Text>
        </Section>

        <Text style={textBold}>Wasn't you?</Text>
        <Text style={text}>
          Secure your account immediately — reset your password and revoke active sessions.
        </Text>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={`${SITE_URL}/security`} style={button}>Secure account</Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Security Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewLoginDetectedEmail,
  subject: 'New sign-in to your Aureon AI account',
  displayName: 'New login detected',
  previewData: {
    name: 'Asher',
    device: 'MacBook Pro',
    browser: 'Chrome 132',
    location: 'San Francisco, CA, US',
    ipAddress: '198.51.100.42',
    loginTime: 'Tue, 26 May 2026 22:14:00 GMT',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 20px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 16px' }
const textBold = { fontSize: '15px', color: '#0a0a0a', fontWeight: 600 as const, margin: '24px 0 8px' }
const card = { backgroundColor: '#f7f7f7', border: '1px solid #eee', borderRadius: '10px', padding: '16px 20px', margin: '0 0 16px' }
const row = { fontSize: '14px', margin: '6px 0', display: 'flex' as const, justifyContent: 'space-between' as const }
const lbl = { color: '#777' }
const val = { color: '#0a0a0a', fontWeight: 500 as const }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
