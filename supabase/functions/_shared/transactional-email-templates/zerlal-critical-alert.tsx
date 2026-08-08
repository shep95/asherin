/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note, Subhed } from '../email-theme.tsx'

interface Finding {
  title: string
  severity: string
  file_path?: string
  line_number?: number
  cwe_id?: string
  cvss_score?: number
}

interface Props {
  projectName?: string
  criticalCount?: number
  findings?: Finding[]
  reportUrl?: string
  completedAt?: string
}

const ZerlalCriticalAlertEmail = ({
  projectName = 'Untitled project',
  criticalCount = 0,
  findings = [],
  reportUrl = 'https://asherin.com/dashboard/zerlal',
  completedAt = new Date().toUTCString(),
}: Props) => (
  <Shell preview={`CRITICAL · ${criticalCount} finding(s) in ${projectName}`} eyebrow="ZERLAL · Critical Alert">
    <Hed>Critical findings detected.</Hed>
    <Prose>
      ZERLAL surfaced <strong>{criticalCount}</strong> critical-severity issue(s) in
      <strong> {projectName}</strong>. Immediate review recommended.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Project', value: projectName },
        { label: 'Critical count', value: String(criticalCount) },
        { label: 'Detected', value: completedAt },
      ]}
    />
    {findings.length > 0 && (
      <>
        <Subhed>All critical findings ({findings.length})</Subhed>
        <MetaCard
          rows={findings.map((f) => ({
            label: (f.cwe_id || f.severity || 'CRIT').toString().toUpperCase(),
            value: `${f.title}${f.file_path ? ` — ${f.file_path}${f.line_number ? `:${f.line_number}` : ''}` : ''}${typeof f.cvss_score === 'number' && f.cvss_score > 0 ? ` (CVSS ${f.cvss_score})` : ''}`,
          }))}
        />
      </>
    )}
    <Cta href={reportUrl} label="Triage now" />
    <Note>You're receiving this because critical-finding alerts are enabled in ZERLAL Settings.</Note>
  </Shell>
)

export const template = {
  component: ZerlalCriticalAlertEmail,
  subject: (d: Record<string, any>) =>
    `🚨 ZERLAL · ${d?.criticalCount ?? 0} critical finding(s) in ${d?.projectName ?? 'project'}`,
  displayName: 'ZERLAL critical alert',
  previewData: {
    projectName: 'aureon-core',
    criticalCount: 2,
    findings: [
      { title: 'Unparameterized SQL in invoice lookup', severity: 'critical', file_path: 'src/billing/invoice.ts', line_number: 142, cwe_id: 'CWE-89', cvss_score: 9.4 },
      { title: 'Hardcoded JWT signing key', severity: 'critical', file_path: 'src/auth/jwt.ts', line_number: 18, cwe_id: 'CWE-798', cvss_score: 9.1 },
    ],
    reportUrl: 'https://asherin.com/dashboard/zerlal',
    completedAt: 'Fri, 12 Jun 2026 04:21:00 GMT',
  },
} satisfies TemplateEntry
