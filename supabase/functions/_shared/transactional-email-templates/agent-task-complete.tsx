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
  agentName?: string
  taskName?: string
  summary?: string
  resultUrl?: string
  completedAt?: string
  durationMs?: number
}

const AgentTaskCompleteEmail = ({
  name,
  agentName = 'Zophiel Agent',
  taskName = 'Scheduled task',
  summary,
  resultUrl,
  completedAt = new Date().toUTCString(),
  durationMs,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{agentName} finished: {taskName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>AUREON · AGENTS</Text>
        <Heading style={h1}>Task complete.</Heading>
        <Text style={text}>
          {name ? `${name}, your` : 'Your'} agent <strong>{agentName}</strong> finished
          <strong> {taskName}</strong>.
        </Text>

        {summary && (
          <Section style={card}>
            <Text style={lbl}>Summary</Text>
            <Text style={summaryText}>{summary}</Text>
          </Section>
        )}

        <Section style={meta}>
          <Text style={metaRow}>Completed: {completedAt}</Text>
          {typeof durationMs === 'number' && (
            <Text style={metaRow}>Duration: {(durationMs / 1000).toFixed(1)}s</Text>
          )}
        </Section>

        {resultUrl && (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={resultUrl} style={button}>View results</Button>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={small}>Manage this agent's notification settings in your dashboard.</Text>
        <Text style={footer}>— {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AgentTaskCompleteEmail,
  subject: (d: Record<string, any>) => `${d?.agentName ?? 'Agent'} finished: ${d?.taskName ?? 'task'}`,
  displayName: 'Agent task complete',
  previewData: {
    name: 'Asher',
    agentName: 'Zophiel OSINT Scout',
    taskName: 'Weekly threat intelligence sweep',
    summary: 'Scanned 30 sources, surfaced 4 high-confidence leads and 12 secondary signals across the monitored entities.',
    resultUrl: `${SITE_URL}/agents/runs/latest`,
    completedAt: 'Tue, 26 May 2026 22:14:00 GMT',
    durationMs: 47200,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '40px 28px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontSize: '12px', letterSpacing: '4px', color: '#888', fontWeight: 600 as const, margin: '0 0 32px' }
const h1 = { fontSize: '28px', fontWeight: 600 as const, color: '#0a0a0a', margin: '0 0 20px', lineHeight: '1.2' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: '#f7f7f7', border: '1px solid #eee', borderRadius: '10px', padding: '16px 20px', margin: '0 0 16px' }
const lbl = { fontSize: '12px', color: '#888', letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 6px' }
const summaryText = { fontSize: '14px', color: '#0a0a0a', lineHeight: '1.6', margin: '0' }
const meta = { margin: '0 0 16px' }
const metaRow = { fontSize: '13px', color: '#666', margin: '2px 0' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 as const, display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '32px 0' }
const small = { fontSize: '13px', color: '#666', margin: '0 0 8px' }
const footer = { fontSize: '13px', color: '#999', margin: '0' }
