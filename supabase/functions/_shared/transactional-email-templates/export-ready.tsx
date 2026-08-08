/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note } from '../email-theme.tsx'

interface Props {
  name?: string
  exportType?: string
  fileName?: string
  fileSize?: string
  downloadUrl?: string
  expiresAt?: string
}

const ExportReadyEmail = ({
  name,
  exportType = 'Data export',
  fileName,
  fileSize,
  downloadUrl = '#',
  expiresAt,
}: Props) => (
  <Shell preview={`Your ${exportType} is ready.`} eyebrow="Exports">
    <Hed>Your export is ready.</Hed>
    <Prose>
      {name ? `${name}, your` : 'Your'} <strong>{exportType}</strong> has finished processing.
    </Prose>
    <MetaCard
      rows={[
        ...(fileName ? [{ label: 'File', value: fileName }] : []),
        ...(fileSize ? [{ label: 'Size', value: fileSize }] : []),
        ...(expiresAt ? [{ label: 'Expires', value: expiresAt }] : []),
      ]}
    />
    <Cta href={downloadUrl} label="Download export" />
    {expiresAt && <Note>Link expires on {expiresAt}. Re-export from your dashboard if needed.</Note>}
  </Shell>
)

export const template = {
  component: ExportReadyEmail,
  subject: (d: Record<string, any>) => `Your ${d?.exportType ?? 'export'} is ready`,
  displayName: 'Export ready',
  previewData: {
    name: 'Asher',
    exportType: 'Conversation archive',
    fileName: 'aureon-conversations-2026-05.zip',
    fileSize: '14.2 MB',
    downloadUrl: 'https://asherin.com/exports/abc123',
    expiresAt: 'June 2, 2026',
  },
} satisfies TemplateEntry
