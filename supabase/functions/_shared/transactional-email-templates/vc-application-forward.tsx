import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  companyName?: string
  founderName?: string
  founderEmail?: string
  website?: string
  compositeScore?: number
  successProbability?: number
  executiveSummary?: string
  strengths?: string[]
  weaknesses?: string[]
  redFlags?: string[]
  recommendation?: string
  applicationId?: string
  fullAnswers?: Record<string, string>
}

const renderList = (items?: string[]) =>
  items && items.length > 0
    ? items.map((item, i) => (
        <Text key={i} style={listItem}>• {item}</Text>
      ))
    : <Text style={listItem}>— None recorded —</Text>

const VCForwardEmail = ({
  companyName, founderName, founderEmail, website,
  compositeScore, successProbability, executiveSummary,
  strengths, weaknesses, redFlags, recommendation,
  applicationId, fullAnswers,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New approved venture: {companyName || 'Unnamed'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>◈ HOUSEOFASHER · SENATE BRIEFING</Text>
        <Heading style={h1}>{companyName || 'Unnamed Venture'}</Heading>
        <Text style={subhead}>
          Asherin Recommendation: <strong>{recommendation || 'Advance'}</strong>
        </Text>

        <Section style={metaBox}>
          <Text style={metaRow}><strong>Founder:</strong> {founderName || '—'}</Text>
          <Text style={metaRow}><strong>Email:</strong> {founderEmail || '—'}</Text>
          {website && <Text style={metaRow}><strong>Website:</strong> {website}</Text>}
          <Text style={metaRow}>
            <strong>Composite Score:</strong> {compositeScore ?? '—'} / 100
          </Text>
          <Text style={metaRow}>
            <strong>Success Probability:</strong> {successProbability != null ? `${successProbability}%` : '—'}
          </Text>
          {applicationId && <Text style={metaRow}><strong>Application ID:</strong> {applicationId}</Text>}
        </Section>

        <Heading as="h2" style={h2}>Executive Summary</Heading>
        <Text style={text}>{executiveSummary || '—'}</Text>

        <Heading as="h2" style={h2}>Top Strengths</Heading>
        {renderList(strengths)}

        <Heading as="h2" style={h2}>Top Weaknesses</Heading>
        {renderList(weaknesses)}

        <Heading as="h2" style={h2}>Fraud Flags / High-Entropy Signals</Heading>
        {renderList(redFlags)}

        {fullAnswers && Object.keys(fullAnswers).length > 0 && (
          <>
            <Hr style={hr} />
            <Heading as="h2" style={h2}>Full Application Responses</Heading>
            {Object.entries(fullAnswers).map(([q, a]) => (
              <Section key={q} style={qaBox}>
                <Text style={qLabel}>{q}</Text>
                <Text style={aText}>{a}</Text>
              </Section>
            ))}
          </>
        )}

        <Hr style={hr} />
        <Text style={footer}>— Asherin Intelligence · HouseOfAsher</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VCForwardEmail,
  subject: (data: Record<string, any>) =>
    `[Senate] Approved venture — ${data?.companyName || 'Unnamed'}`,
  displayName: 'VC application forward (Senate)',
  previewData: {
    companyName: 'Acme Labs',
    founderName: 'Jane Doe',
    founderEmail: 'jane@acme.com',
    compositeScore: 82,
    successProbability: 74,
    executiveSummary: 'Strong defensible moat in vertical AI for finance.',
    strengths: ['Founder has prior exit', 'Clear TAM with bottom-up validation'],
    weaknesses: ['CAC unverified', 'No second engineer'],
    redFlags: [],
    recommendation: 'Strong Buy',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '40px 32px', maxWidth: '640px', margin: '0 auto' }
const brand = { fontSize: '11px', letterSpacing: '0.25em', color: '#111111', fontWeight: 600, margin: '0 0 16px' }
const h1 = { fontSize: '26px', fontWeight: 300, color: '#000000', margin: '0 0 8px', letterSpacing: '-0.01em' }
const subhead = { fontSize: '13px', color: '#555555', margin: '0 0 24px' }
const metaBox = { backgroundColor: '#f6f6f6', border: '1px solid #eeeeee', borderRadius: '8px', padding: '16px 18px', margin: '0 0 24px' }
const metaRow = { fontSize: '13px', color: '#333333', margin: '4px 0', lineHeight: '1.5' }
const h2 = { fontSize: '14px', fontWeight: 600, color: '#000000', margin: '24px 0 10px', letterSpacing: '0.02em' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 12px' }
const listItem = { fontSize: '13px', color: '#333333', lineHeight: '1.55', margin: '4px 0' }
const qaBox = { borderLeft: '2px solid #dddddd', paddingLeft: '12px', margin: '12px 0' }
const qLabel = { fontSize: '12px', color: '#888888', margin: '0 0 4px', fontWeight: 600 }
const aText = { fontSize: '13px', color: '#222222', lineHeight: '1.55', margin: 0, whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#eeeeee', margin: '28px 0 18px' }
const footer = { fontSize: '11px', color: '#999999', letterSpacing: '0.08em', margin: 0 }
