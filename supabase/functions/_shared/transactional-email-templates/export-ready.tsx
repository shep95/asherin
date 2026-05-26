/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Aureon AI'

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
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {exportType} is ready to download</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · EXPORTS</Text>
        <Heading style={h1}>Your export is ready.</Heading>
        <Text style={text}>
          {name ? `${name}, your` : 'Your'} <strong>{exportType}</strong> has finished processing.
        </Text>

        {(fileName || fileSize) && (
          <Section style={card}>
            {fileName && <Text style={metaRow}><span style={lbl}>File</span> {fileName}</Text>}
            {fileSize && <Text style={metaRow}><span style={lbl}>Size</span> {fileSize}</Text>}
            {expiresAt && <Text style={metaRow}><span style={lbl}>Expires</span> {expiresAt}</Text>}
          </Section>
        )}

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={downloadUrl} style={button}>Download export</Button>
        </Section>

        {expiresAt && (
          <Text style={small}>
            This download link expires on {expiresAt}. Re-export from your dashboard if needed.
          </Text>
        )}

        <Hr style={hr} />
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
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
    downloadUrl: 'https://aureonai.app/exports/abc123',
    expiresAt: 'June 2, 2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 20px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#f7f7f7', border: '1px solid #eee', borderRadius: '10px', padding: '14px 20px', margin: '0 0 16px' }
const metaRow = { fontSize: '14px', color: '#0a0a0a', margin: '4px 0' }
const lbl = { color: '#888', display: 'inline-block', minWidth: '70px' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const small = { fontSize: '13px', color: '#666', margin: '0 0 8px' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
