/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Img, Section as Block, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note, Subhed, Soft, T } from '../email-theme.tsx'

/**
 * Generic intelligence-report email — written to the IC finished-product
 * standard (ICD 203 analytic standards, ICD 206 sourcing).
 *
 * Reading order is the IC reading order, and it is not negotiable per module:
 *
 *   banner + serial  →  who may read this, and what to cite it as
 *   BLUF             →  the answer, first, in one paragraph
 *   KEY JUDGMENTS    →  numbered, portion-marked, each carrying its own
 *                       likelihood term and confidence
 *   KEY FACTS        →  the substantive collection, as a table
 *   apparatus        →  Scope Note, Source Summary, Outlook, Alternative
 *                       Analysis, Intelligence Gaps, Confidence, Handling
 *
 * The apparatus sections arrive already ordered and already gap-filled by
 * icTradecraft.buildIcProduct on the delivery bus, so this template never
 * decides what a report should contain — it only decides how it looks. That
 * separation is why a module can be upgraded without touching the mail.
 *
 * `imageUrl` and the secondary CTA remain optional; account-security alerts
 * use them for a satellite frame and a "lock the account" escape hatch.
 */

interface Section {
  label?: string
  value?: string
}

interface Props {
  title?: string
  body?: string
  severity?: string
  source?: string
  subjectName?: string
  sections?: Section[]
  findings?: string[]
  reportUrl?: string
  generatedAt?: string
  banner?: string
  reportNumber?: string
  confidence?: string
  imageUrl?: string
  imageCaption?: string
  secondaryCtaLabel?: string
  secondaryCtaUrl?: string
}

const SEVERITY_LABEL: Record<string, string> = {
  info: 'ROUTINE',
  notable: 'NOTABLE',
  critical: 'CRITICAL',
}

/** Sections that are analytic apparatus, rendered as prose, not table rows. */
const APPARATUS = [
  'SCOPE NOTE',
  'SOURCE SUMMARY',
  'OUTLOOK',
  'ALTERNATIVE ANALYSIS',
  'INTELLIGENCE GAPS',
  'CONFIDENCE',
  'HANDLING',
]

const APPARATUS_TITLE: Record<string, string> = {
  'SCOPE NOTE': 'Scope note',
  'SOURCE SUMMARY': 'Source summary statement',
  OUTLOOK: 'Outlook',
  'ALTERNATIVE ANALYSIS': 'Alternative analysis — what would change this',
  'INTELLIGENCE GAPS': 'Intelligence gaps',
  CONFIDENCE: 'Confidence in this assessment',
  HANDLING: 'Handling and distribution',
}

const bannerStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '10px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: T.mute,
  fontWeight: 700,
  textAlign: 'center',
  border: `1px solid ${T.panelEdge}`,
  backgroundColor: T.panel,
  borderRadius: '6px',
  padding: '8px 10px',
  margin: '0 0 26px',
}

const serialStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '11px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: T.faint,
  fontWeight: 600,
  margin: '0 0 18px',
}

const judgmentStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '15px',
  color: T.ink,
  lineHeight: 1.6,
  margin: '0 0 12px',
  paddingLeft: '14px',
  borderLeft: `2px solid ${T.hairline}`,
  fontWeight: 400,
}

const figure: React.CSSProperties = {
  border: `1px solid ${T.panelEdge}`,
  borderRadius: '14px',
  overflow: 'hidden',
  margin: '0 0 8px',
}

const captionStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '11px',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: T.faint,
  fontWeight: 600,
  margin: '0 0 24px',
}

const IntelligenceReportEmail = ({
  title = 'Intelligence report ready',
  body = '',
  severity = 'info',
  source = 'Asherin Intelligence',
  subjectName = '',
  sections = [],
  findings = [],
  reportUrl = 'https://asherin.com/dashboard',
  generatedAt = new Date().toUTCString(),
  banner = 'OPEN SOURCE · UNCLASSIFIED//OSINT · ADDRESSEE EYES ONLY',
  reportNumber = '',
  confidence = '',
  imageUrl = '',
  imageCaption = '',
  secondaryCtaLabel = '',
  secondaryCtaUrl = '',
}: Props) => {
  const band = SEVERITY_LABEL[severity] ?? 'ROUTINE'

  const clean = sections.filter((s) => s?.label && s?.value)
  const facts = clean.filter((s) => !APPARATUS.includes(String(s.label).toUpperCase()))
  const apparatus = APPARATUS.map((key) => {
    const hit = clean.find((s) => String(s.label).toUpperCase() === key)
    return hit ? { key, value: String(hit.value) } : null
  }).filter(Boolean) as Array<{ key: string; value: string }>

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'PRIORITY', value: band },
    ...(subjectName ? [{ label: 'SUBJECT', value: subjectName }] : []),
    ...(confidence ? [{ label: 'CONFIDENCE', value: confidence.toUpperCase() }] : []),
    { label: 'PRODUCED BY', value: source },
    { label: 'INFORMATION CUTOFF', value: generatedAt },
    ...facts
      .slice(0, 16)
      .map((s) => ({ label: String(s.label).toUpperCase(), value: String(s.value) })),
  ]

  // Only render a remote image over https — an http asset is stripped or
  // flagged by most mail clients and leaks the open in cleartext.
  const showImage = /^https:\/\//.test(imageUrl)

  return (
    <Shell preview={`${band} · ${title}`} eyebrow="ASHERIN · INTELLIGENCE REPORT">
      <Text style={bannerStyle}>{banner}</Text>
      <Hed>{title}</Hed>
      {reportNumber ? <Text style={serialStyle}>Report {reportNumber}</Text> : null}
      {body ? <Prose>{body}</Prose> : null}

      {showImage ? (
        <>
          <Block style={figure}>
            <Img
              src={imageUrl}
              alt={imageCaption || 'Satellite frame of the reported origin'}
              width="560"
              height="320"
              style={{ display: 'block', width: '100%', maxWidth: '560px', height: 'auto' }}
            />
          </Block>
          <Text style={captionStyle}>
            {imageCaption || 'Satellite frame · reported origin'}
          </Text>
        </>
      ) : null}

      {findings.length > 0 ? (
        <>
          <Subhed>Key judgments</Subhed>
          {findings.slice(0, 14).map((f, i) => (
            <Text key={i} style={judgmentStyle}>
              {i + 1}. {f}
            </Text>
          ))}
        </>
      ) : null}

      <Subhed>Key facts</Subhed>
      <MetaCard rows={rows} />

      {apparatus.map((a) => (
        <React.Fragment key={a.key}>
          <Subhed>{APPARATUS_TITLE[a.key] ?? a.key}</Subhed>
          <Soft>{a.value}</Soft>
        </React.Fragment>
      ))}

      <Cta href={reportUrl} label="Open the full report" />

      {secondaryCtaLabel && secondaryCtaUrl ? (
        <Cta href={secondaryCtaUrl} label={secondaryCtaLabel} variant="ghost" />
      ) : null}

      <Note>
        Open sources only. Absence of a record is not a clearance, and a match on a
        common name is not an identification. Treat every line as a lead to verify,
        not a fact to act on.
      </Note>
      <Note>#houseofasher — restricted, addressee eyes only.</Note>
    </Shell>
  )
}

export const template = {
  component: IntelligenceReportEmail,
  subject: (data: Record<string, any>) => {
    const band = SEVERITY_LABEL[String(data?.severity ?? 'info')] ?? 'ROUTINE'
    return `${band} · ${String(data?.title ?? 'Intelligence report ready').slice(0, 90)}`
  },
  displayName: 'Intelligence report',
  previewData: {
    title: 'Dossier ready — Marcus Vail',
    body:
      'We assess with moderate confidence that the correspondent is very likely (80–95%) the Marcus Vail employed by the named Fulton County firm. Two independent records corroborate the employment; no adverse court record was located in that jurisdiction.',
    severity: 'notable',
    source: 'Cloud Intelligence Mesh',
    subjectName: 'Marcus Vail',
    confidence: 'moderate',
    reportNumber: 'ASH-CONTACT-20260808-4F2A',
    findings: [
      '(U) We assess with moderate confidence that the correspondent is very likely (80–95%) the named individual; the binding evidence is employer plus locality, not a document.',
      '(U) We judge it unlikely (20–45%) that a second individual of the same name in this locality accounts for the records, on the basis of two non-overlapping sources [B2].',
    ],
    sections: [
      { label: 'Identity confidence', value: '0.81 — bound by employer and locality [B2]' },
      { label: 'Jurisdiction', value: 'Fulton County, Georgia' },
      {
        label: 'SOURCE SUMMARY',
        value:
          'Derived from open sources and from telemetry the account itself is connected to. Lines carrying an Admiralty grade are graded; ungraded lines are single-source and uncorroborated.',
      },
      {
        label: 'ALTERNATIVE ANALYSIS',
        value:
          'A same-name resident of the same county would explain the address history but not the employer match. A single contradicting employment record would flip this judgment.',
      },
      {
        label: 'INTELLIGENCE GAPS',
        value:
          'No date of birth was recovered, so records are bound by name and locality only. Absence of a court record is not evidence of absence.',
      },
      {
        label: 'CONFIDENCE',
        value:
          'Moderate confidence — credibly sourced and plausible, but corroboration is partial and alternative explanations remain open.',
      },
      {
        label: 'HANDLING',
        value:
          'Addressee eyes only. Not a consumer report: must not be used for any employment, tenancy, credit, insurance or licensing decision.',
      },
    ],
    reportUrl: 'https://asherin.com/dashboard',
    generatedAt: new Date().toUTCString(),
  },
} satisfies TemplateEntry
