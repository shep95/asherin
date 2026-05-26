/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'
const SITE_URL = 'https://aureonai.app'

interface Props { name?: string }

const WelcomeEmail = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — your intelligence platform is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON</Text>
        <Heading style={h1}>{name ? `Welcome, ${name}.` : 'Welcome.'}</Heading>
        <Text style={text}>
          Your access to {SITE_NAME} is active. You now have an intelligence
          platform built for clarity, depth, and signal — no noise.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={SITE_URL} style={button}>Open Aureon</Button>
        </Section>
        <Hr style={hr} />
        <Text style={small}>
          Questions? Just reply to this email. We read everything.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to Aureon AI',
  displayName: 'Welcome',
  previewData: { name: 'Asher' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 20px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const small = { fontSize: '13px', color: '#666', margin: '0 0 8px' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
