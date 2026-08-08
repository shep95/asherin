/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note, Subhed } from '../email-theme.tsx'

/**
 * Generic intelligence-report email. Every Asherin module that produces an
 * intelligence product emails through this one template so the rider/analyst
 * sees a single consistent artefact rather than a per-module dialect.
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
}

const SEVERITY_LABEL: Record<string, string> = {
  info: 'ROUTINE',
  notable: 'NOTABLE',
  critical: 'CRITICAL',
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
}: Props) => {
  const band = SEVERITY_LABEL[severity] ?? 'ROUTINE'
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'PRIORITY', value: band },
    ...(subjectName ? [{ label: 'SUBJECT', value: subjectName }] : []),
    { label: 'SOURCE MODULE', value: source },
    { label: 'GENERATED', value: generatedAt },
    ...sections
      .filter((s) => s?.label && s?.value)
      .slice(0, 12)
      .map((s) => ({ label: String(s.label).toUpperCase(), value: String(s.value) })),
  ]

  return (
    <Shell preview={`${band} · ${title}`} eyebrow="ASHERIN · INTELLIGENCE REPORT">
      <Hed>{title}</Hed>
      {body ? <Prose>{body}</Prose> : null}

      <MetaCard rows={rows} />

      {findings.length > 0 ? (
        <>
          <Subhed>Findings</Subhed>
          {findings.slice(0, 12).map((f, i) => (
            <Prose key={i}>— {f}</Prose>
          ))}
        </>
      ) : null}

      <Cta href={reportUrl} label="Open the full report" />

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
