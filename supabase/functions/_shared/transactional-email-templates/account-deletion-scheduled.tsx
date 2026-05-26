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
  scheduledDeletionDate?: string
  cancelUrl?: string
}

const AccountDeletionScheduledEmail = ({
  name,
  scheduledDeletionDate = '30 days from now',
  cancelUrl = `${SITE_URL}/account`,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} account is scheduled for deletion</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · ACCOUNT</Text>
        <Heading style={h1}>Account deletion scheduled.</Heading>
        <Text style={text}>
          {name ? `${name}, we've` : "We've"} received your request to delete your {SITE_NAME} account.
        </Text>

        <Section style={card}>
          <Text style={metaRow}>
            <span style={lbl}>Deletion date</span>
            <strong>{scheduledDeletionDate}</strong>
          </Text>
        </Section>

        <Text style={text}>
          On that date, your account, conversations, intelligence files, and all
          associated data will be permanently erased. This action cannot be undone.
        </Text>

        <Text style={textBold}>Changed your mind?</Text>
        <Text style={text}>You can cancel the deletion any time before that date.</Text>

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={cancelUrl} style={button}>Cancel deletion</Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccountDeletionScheduledEmail,
  subject: 'Your Aureon AI account is scheduled for deletion',
  displayName: 'Account deletion scheduled',
  previewData: {
    name: 'Asher',
    scheduledDeletionDate: 'June 25, 2026',
    cancelUrl: 'https://aureonai.app/account',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 20px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 16px' }
const textBold = { fontSize: '15px', color: '#0a0a0a', fontWeight: 600 as const, margin: '24px 0 8px' }
const card = { backgroundColor: '#f7f7f7', border: '1px solid #eee', borderRadius: '10px', padding: '14px 20px', margin: '0 0 16px' }
const metaRow = { fontSize: '14px', color: '#0a0a0a', margin: '4px 0' }
const lbl = { color: '#888', display: 'inline-block', minWidth: '120px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
