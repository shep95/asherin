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

interface ScanError {
  phase?: string
  section?: number | null
  message?: string
}

interface Props {
  projectName?: string
  riskGrade?: string
  findingsCount?: number
  criticalCount?: number
  highCount?: number
  mediumCount?: number
  lowCount?: number
  infoCount?: number
  durationSec?: number
  scanProfile?: string
  summary?: string
  reportUrl?: string
  completedAt?: string
  findings?: Finding[]
  errors?: ScanError[]
  errorsCount?: number
  scanStatus?: 'completed' | 'completed_with_errors' | 'failed'
}

const statusLabel = (s?: string) => {
  if (s === 'failed') return 'Failed'
  if (s === 'completed_with_errors') return 'Completed with errors'
  return 'Completed cleanly'
}

const ZerlalScanReportEmail = ({
  projectName = 'Untitled project',
  riskGrade = 'F',
  findingsCount = 0,
  criticalCount = 0,
  highCount = 0,
  mediumCount = 0,
  lowCount = 0,
  infoCount = 0,
  durationSec,
  scanProfile = 'security-audit',
  summary,
  reportUrl = 'https://asherin.com/dashboard/zerlal',
  completedAt = new Date().toUTCString(),
  findings = [],
  errors = [],
  errorsCount = 0,
  scanStatus = 'completed',
}: Props) => (
  <Shell preview={`ZERLAL ${statusLabel(scanStatus)} — Grade ${riskGrade} · ${findingsCount} findings${errorsCount ? ` · ${errorsCount} errors` : ''}`} eyebrow="ZERLAL · Security Report">
    <Hed>{scanStatus === 'failed' ? 'Scan failed.' : 'Scan complete.'}</Hed>
    <Prose>
      <strong>{projectName}</strong> finished a <strong>{scanProfile}</strong> sweep. Overall risk grade
      assessed at <strong>{riskGrade}</strong> across <strong>{findingsCount}</strong> findings.
      {errorsCount > 0 && (
        <> The audit encountered <strong>{errorsCount}</strong> error{errorsCount === 1 ? '' : 's'} during execution — see details below.</>
      )}
    </Prose>
    <MetaCard
      rows={[
        { label: 'Project', value: projectName },
        { label: 'Profile', value: scanProfile },
        { label: 'Status', value: statusLabel(scanStatus) },
        { label: 'Risk grade', value: riskGrade },
        { label: 'Errors', value: String(errorsCount) },
        { label: 'Completed', value: completedAt },
        ...(typeof durationSec === 'number' ? [{ label: 'Duration', value: `${durationSec}s` }] : []),
      ]}
    />
    <Subhed>Severity breakdown</Subhed>
    <MetaCard
      rows={[
        { label: 'Critical', value: String(criticalCount) },
        { label: 'High', value: String(highCount) },
        { label: 'Medium', value: String(mediumCount) },
        { label: 'Low', value: String(lowCount) },
        { label: 'Info', value: String(infoCount) },
      ]}
    />
    {summary && <Prose>{summary}</Prose>}
    {errors.length > 0 && (
      <>
        <Subhed>Audit errors ({errorsCount})</Subhed>
        <Prose>
          The following sections did not complete normally. Findings from these sections may be missing or incomplete.
        </Prose>
        <MetaCard
          rows={errors.map((e) => ({
            label: `${(e.phase || 'section').toUpperCase()}${typeof e.section === 'number' ? ` · #${e.section}` : ''}`,
            value: e.message || 'Unknown error',
          }))}
        />
      </>
    )}
    {findings.length > 0 && (
      <>
        <Subhed>Top findings ({findings.length})</Subhed>
        <MetaCard
          rows={findings.map((f) => ({
            label: `${(f.severity || 'INFO').toString().toUpperCase()}${f.cwe_id ? ` · ${f.cwe_id}` : ''}`,
            value: `${f.title}${f.file_path ? ` — ${f.file_path}${f.line_number ? `:${f.line_number}` : ''}` : ''}${typeof f.cvss_score === 'number' && f.cvss_score > 0 ? ` (CVSS ${f.cvss_score})` : ''}`,
          }))}
        />
      </>
    )}
    <Cta href={reportUrl} label="Open full report" />
    <Note>Manage scan cadence and alert preferences from ZERLAL Settings.</Note>
  </Shell>
)

export const template = {
  component: ZerlalScanReportEmail,
  subject: (d: Record<string, any>) =>
    `ZERLAL · ${d?.projectName ?? 'Project'} — Grade ${d?.riskGrade ?? 'F'} · ${d?.findingsCount ?? 0} findings`,
  displayName: 'ZERLAL scan report',
  previewData: {
    projectName: 'aureon-core',
    riskGrade: 'C',
    findingsCount: 47,
    criticalCount: 2,
    highCount: 9,
    mediumCount: 18,
    lowCount: 12,
    infoCount: 6,
    durationSec: 184,
    scanProfile: 'security-audit',
    summary: 'Two critical findings stem from unparameterized SQL in the billing module. Patch order prioritized in dashboard.',
    reportUrl: 'https://asherin.com/dashboard/zerlal',
    completedAt: 'Fri, 12 Jun 2026 04:21:00 GMT',
  },
} satisfies TemplateEntry
