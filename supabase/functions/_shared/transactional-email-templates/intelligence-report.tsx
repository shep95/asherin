/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Img, Section as Block, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note, Subhed, T } from '../email-theme.tsx'

/**
 * Generic intelligence-report email. Every Asherin module that produces an
 * intelligence product emails through this one template so the analyst sees a
 * single consistent artefact rather than a per-module dialect.
 *
 * `imageUrl` and the secondary CTA are optional. Account-security alerts use
 * them to place a satellite frame of the actor's origin above the meta card
 * and a "lock the account" escape hatch under the primary button. Modules
 * that pass neither render exactly as they always did.
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
  imageUrl = '',
  imageCaption = '',
  secondaryCtaLabel = '',
  secondaryCtaUrl = '',
}: Props) => {
  const band = SEVERITY_LABEL[severity] ?? 'ROUTINE'
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'PRIORITY', value: band },
    ...(subjectName ? [{ label: 'SUBJECT', value: subjectName }] : []),
    { label: 'SOURCE MODULE', value: source },
    { label: 'GENERATED', value: generatedAt },
    ...sections
      .filter((s) => s?.label && s?.value)
      .slice(0, 16)
      .map((s) => ({ label: String(s.label).toUpperCase(), value: String(s.value) })),
  ]

  // Only render a remote image over https — an http asset is stripped or
  // flagged by most mail clients and leaks the open in cleartext.
  const showImage = /^https:\/\//.test(imageUrl)

  return (
    <Shell preview={`${band} · ${title}`} eyebrow="ASHERIN · INTELLIGENCE REPORT">
      <Hed>{title}</Hed>
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

      <MetaCard rows={rows} />

      {findings.length > 0 ? (
        <>
          <Subhed>Findings</Subhed>
          {findings.slice(0, 14).map((f, i) => (
            <Prose key={i}>— {f}</Prose>
          ))}
        </>
      ) : null}

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
    body: 'Correspondent swept across 30 open sources. Two corroborated employment records, one address history, no adverse court record in the named jurisdiction.',
    severity: 'notable',
    source: 'Cloud Intelligence Mesh',
    subjectName: 'Marcus Vail',
    sections: [
      { label: 'Identity confidence', value: '0.81 — bound by employer and locality' },
      { label: 'Jurisdiction', value: 'Fulton County, Georgia' },
    ],
    findings: [
      'Employer corroborated by two independent sources.',
      'No adverse court record located in the named jurisdiction.',
    ],
    reportUrl: 'https://asherin.com/dashboard',
    generatedAt: new Date().toUTCString(),
  },
} satisfies TemplateEntry
