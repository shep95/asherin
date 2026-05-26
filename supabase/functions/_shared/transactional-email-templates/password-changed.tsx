/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'
const SITE_URL = 'https://aureonai.app'

interface Props { name?: string; changedAt?: string }

const PasswordChangedEmail = ({ name, changedAt = new Date().toUTCString() }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} password was changed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · SECURITY</Text>
        <Heading style={h1}>Password changed.</Heading>
        <Text style={text}>
          {name ? `${name}, your` : 'Your'} {SITE_NAME} account password was updated on {changedAt}.
        </Text>
        <Text style={text}>
          If you made this change, no further action is needed. If you did not,
          your account may be compromised — secure it now.
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
  component: PasswordChangedEmail,
  subject: 'Your Aureon AI password was changed',
  displayName: 'Password changed',
  previewData: { name: 'Asher', changedAt: 'Tue, 26 May 2026 22:14:00 GMT' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 20px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
