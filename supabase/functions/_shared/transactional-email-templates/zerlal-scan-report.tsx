/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note, Subhed } from '../email-theme.tsx'

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
  reportUrl = 'https://aureonai.app/dashboard/zerlal',
  completedAt = new Date().toUTCString(),
}: Props) => (
  <Shell preview={`ZERLAL scan complete — Grade ${riskGrade} · ${findingsCount} findings`} eyebrow="ZERLAL · Security Report">
    <Hed>Scan complete.</Hed>
    <Prose>
      <strong>{projectName}</strong> finished a <strong>{scanProfile}</strong> sweep. Overall risk grade
      assessed at <strong>{riskGrade}</strong> across <strong>{findingsCount}</strong> findings.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Project', value: projectName },
        { label: 'Profile', value: scanProfile },
        { label: 'Risk grade', value: riskGrade },
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
    reportUrl: 'https://aureonai.app/dashboard/zerlal',
    completedAt: 'Fri, 12 Jun 2026 04:21:00 GMT',
  },
} satisfies TemplateEntry
