/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Subhed, Prose, Soft, Note } from '../email-theme.tsx'

interface PostItem {
  title: string
  body: string
  author: string
  created_at: string
  score?: number
}
interface Props {
  date?: string
  bugs?: PostItem[]
  theories?: PostItem[]
  topIdea?: PostItem | null
  ideasRunnersUp?: PostItem[]
  randomBugs?: PostItem[]
}

const Section = ({ title, items, emptyLabel }: { title: string; items: PostItem[]; emptyLabel: string }) => (
  <div style={{ marginTop: 20 }}>
    <Subhed>{title}</Subhed>
    {items.length === 0 ? (
      <Soft>{emptyLabel}</Soft>
    ) : (
      items.map((p, i) => (
        <div key={i} style={{ borderTop: '1px solid #eee', padding: '10px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{p.title}</div>
          <div style={{ fontSize: 12, color: '#666', margin: '2px 0 6px' }}>
            {p.author} · {new Date(p.created_at).toLocaleString()}
            {typeof p.score === 'number' ? ` · score ${p.score}` : ''}
          </div>
          <div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap' }}>
            {p.body.length > 600 ? p.body.slice(0, 600) + '…' : p.body}
          </div>
        </div>
      ))
    )}
  </div>
)

const Digest = ({
  date = new Date().toISOString().slice(0, 10),
  bugs = [], theories = [], topIdea = null, ideasRunnersUp = [], randomBugs = [],
}: Props) => (
  <Shell preview={`Asherin Forums Daily Digest — ${date}`} eyebrow="Forums Digest">
    <Hed>Daily Digest — {date}</Hed>
    <Prose>Community activity across ideas, bugs, and theories from the last 24 hours.</Prose>

    {topIdea ? (
      <div style={{ marginTop: 18 }}>
        <Subhed>Top Idea (24h)</Subhed>
        <div style={{ padding: 12, background: '#f7f7f7', borderRadius: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{topIdea.title}</div>
          <div style={{ fontSize: 12, color: '#666', margin: '2px 0 6px' }}>
            {topIdea.author} · score {topIdea.score ?? 0}
          </div>
          <div style={{ fontSize: 13, color: '#222', whiteSpace: 'pre-wrap' }}>{topIdea.body}</div>
        </div>
      </div>
    ) : (
      <Note>No idea votes in the last 24 hours.</Note>
    )}

    <Section title="Runner-Up Ideas" items={ideasRunnersUp} emptyLabel="No other voted ideas." />
    <Section title="Bugs Reported (24h)" items={bugs} emptyLabel="No bugs reported." />
    <Section title="Other / Random Bug Notes" items={randomBugs} emptyLabel="None." />
    <Section title="Theories Submitted (24h) — Open Source" items={theories} emptyLabel="No theories submitted." />

    <Note>
      Theories submitted to Asherin Forums are declared open-source: anyone — including
      other AI systems — may read, cite, and build upon them to advance AI for humanity.
    </Note>
  </Shell>
)

export const template = {
  component: Digest,
  subject: (d: Record<string, any>) => `Asherin Forums Digest — ${d?.date ?? new Date().toISOString().slice(0, 10)}`,
  displayName: 'Forum Daily Digest',
  to: 'ASHERIN_DIGEST_RECIPIENT', // resolved from the secret at send time — never a literal mailbox
  previewData: {
    date: '2026-07-02',
    bugs: [{ title: 'Login loop on Safari', body: 'Users bounce back to /auth after login.', author: 'kai', created_at: new Date().toISOString() }],
    theories: [{ title: 'Recursive Prompt Distillation', body: 'Compress prior turns into an ontology…', author: 'nova', created_at: new Date().toISOString() }],
    topIdea: { title: 'Voice mode for Asher', body: 'Push-to-talk in the IDE.', author: 'ren', created_at: new Date().toISOString(), score: 14 },
    ideasRunnersUp: [],
    randomBugs: [],
  },
} satisfies TemplateEntry
