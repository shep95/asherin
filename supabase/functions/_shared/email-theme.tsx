/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

/**
 * AUREON premium email design system.
 *
 * Voice: surgical, calm, declarative. Short sentences. No exclamation marks.
 * No exhortation. Signal over noise. Confidence without volume.
 *
 * Type: 'Instrument Serif' for display headings (editorial weight),
 * 'Inter' for body (modern, neutral, premium feel). Web-safe fallbacks
 * preserved for clients that block remote fonts (Outlook, Gmail clipping).
 */

// ─── TOKENS ───────────────────────────────────────────────────────────────────

export const T = {
  ink:        '#0a0a0a',
  inkSoft:    '#1c1c1e',
  body:       '#2a2a2a',
  mute:       '#6b6b6b',
  faint:      '#9a9a9a',
  hairline:   '#ececec',
  panel:      '#fafafa',
  panelEdge:  '#ededed',
  paper:      '#ffffff',
  accent:     '#0a0a0a',
  serif:      `'Instrument Serif', 'Iowan Old Style', 'Apple Garamond', Georgia, 'Times New Roman', serif`,
  sans:       `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
} as const

// ─── PRIMITIVE STYLES ─────────────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: T.paper,
  fontFamily: T.sans,
  margin: 0,
  padding: 0,
  WebkitFontSmoothing: 'antialiased',
}

const container: React.CSSProperties = {
  maxWidth: '580px',
  margin: '0 auto',
  padding: '56px 40px 48px',
  backgroundColor: T.paper,
}

const brandRow: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '11px',
  letterSpacing: '0.28em',
  color: T.mute,
  fontWeight: 600,
  textTransform: 'uppercase',
  margin: '0 0 40px',
}

const eyebrowStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '10px',
  letterSpacing: '0.32em',
  color: T.faint,
  fontWeight: 600,
  textTransform: 'uppercase',
  margin: '0 0 14px',
}

const hedStyle: React.CSSProperties = {
  fontFamily: T.serif,
  fontSize: '40px',
  fontWeight: 400,
  color: T.ink,
  letterSpacing: '-0.015em',
  lineHeight: 1.08,
  margin: '0 0 28px',
}

const subhedStyle: React.CSSProperties = {
  fontFamily: T.serif,
  fontSize: '22px',
  fontWeight: 400,
  color: T.ink,
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
  margin: '24px 0 12px',
}

const proseStyle: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '15px',
  color: T.body,
  lineHeight: 1.65,
  margin: '0 0 18px',
  fontWeight: 400,
}

const proseSoft: React.CSSProperties = {
  ...proseStyle,
  color: T.mute,
  fontSize: '13px',
  lineHeight: 1.6,
}

const ctaWrap: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0 36px',
}

const ctaBtn: React.CSSProperties = {
  backgroundColor: T.ink,
  color: T.paper,
  fontFamily: T.sans,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  padding: '15px 34px',
  borderRadius: '999px',
  textDecoration: 'none',
  display: 'inline-block',
}

const ghostBtn: React.CSSProperties = {
  ...ctaBtn,
  backgroundColor: 'transparent',
  color: T.ink,
  border: `1px solid ${T.ink}`,
}

const panel: React.CSSProperties = {
  backgroundColor: T.panel,
  border: `1px solid ${T.panelEdge}`,
  borderRadius: '14px',
  padding: '22px 26px',
  margin: '0 0 24px',
}

const metaLabel: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '11px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: T.faint,
  fontWeight: 600,
  margin: '0 0 4px',
}

const metaValue: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '15px',
  color: T.ink,
  fontWeight: 500,
  margin: '0 0 14px',
}

const ruleStyle: React.CSSProperties = {
  border: 'none',
  borderTop: `1px solid ${T.hairline}`,
  margin: '36px 0 20px',
}

const signOff: React.CSSProperties = {
  fontFamily: T.serif,
  fontSize: '15px',
  color: T.mute,
  margin: '0 0 4px',
  fontStyle: 'italic',
}

const footerLine: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: '11px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: T.faint,
  fontWeight: 500,
  margin: '8px 0 0',
}

const linkStyle: React.CSSProperties = {
  color: T.ink,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  textDecorationColor: T.hairline,
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

interface ShellProps {
  preview: string
  eyebrow?: string
  children: React.ReactNode
}

/** Outer shell — html, head, fonts, body, container, brand row. */
export const Shell = ({ preview, eyebrow, children }: ShellProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandRow}>Asherin</Text>
        {eyebrow && <Text style={eyebrowStyle}>{eyebrow}</Text>}
        {children}
        <Hr style={ruleStyle} />
        <Text style={signOff}>— Asherin</Text>
        <Text style={footerLine}>asherin.com · Intelligence, distilled.</Text>
      </Container>
    </Body>
  </Html>
)

export const Hed = ({ children }: { children: React.ReactNode }) => (
  <Heading as="h1" style={hedStyle}>{children}</Heading>
)

export const Subhed = ({ children }: { children: React.ReactNode }) => (
  <Heading as="h2" style={subhedStyle}>{children}</Heading>
)

export const Prose = ({ children }: { children: React.ReactNode }) => (
  <Text style={proseStyle}>{children}</Text>
)

export const Soft = ({ children }: { children: React.ReactNode }) => (
  <Text style={proseSoft}>{children}</Text>
)

export const Cta = ({ href, label, variant = 'solid' }: {
  href: string; label: string; variant?: 'solid' | 'ghost'
}) => (
  <Section style={ctaWrap}>
    <Button style={variant === 'ghost' ? ghostBtn : ctaBtn} href={href}>
      {label}
    </Button>
  </Section>
)

export const MetaCard = ({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) => (
  <Section style={panel}>
    {rows.map((r, i) => (
      <Section key={i} style={{ marginBottom: i === rows.length - 1 ? 0 : 14 }}>
        <Text style={metaLabel}>{r.label}</Text>
        <Text style={{ ...metaValue, margin: 0 }}>{r.value}</Text>
      </Section>
    ))}
  </Section>
)

export const Note = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ ...proseSoft, margin: '4px 0 0' }}>{children}</Text>
)

export const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} style={linkStyle}>{children}</Link>
)

export const Bar = ({ percent }: { percent: number }) => (
  <Section style={{ backgroundColor: T.hairline, borderRadius: '999px', height: '6px', margin: '6px 0 22px', overflow: 'hidden' }}>
    <Section style={{ backgroundColor: T.ink, height: '6px', width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
  </Section>
)
