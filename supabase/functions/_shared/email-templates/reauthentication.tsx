/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { T } from '../email-theme.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500&display=swap"
        rel="stylesheet"
      />
    </Head>
    <Preview>Your verification code: {token}</Preview>
    <Body style={{ backgroundColor: T.paper, fontFamily: T.sans, margin: 0, padding: 0 }}>
      <Container style={{ maxWidth: 580, margin: '0 auto', padding: '56px 40px 48px' }}>
        <Text style={brand}>Asherin</Text>
        <Text style={eyebrow}>Verification</Text>
        <Heading as="h1" style={hed}>Verify it's you.</Heading>
        <Text style={prose}>
          Enter the code below to confirm your identity. The code expires in a few minutes.
        </Text>

        <Section style={codeCard}>
          <Text style={codeText}>{token}</Text>
        </Section>

        <Text style={proseSoft}>
          Didn't ask to verify? Ignore this email and consider changing your password.
        </Text>

        <Hr style={rule} />
        <Text style={signoff}>— Asherin</Text>
        <Text style={footer}>asherin.com · Intelligence, distilled.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const brand = { fontFamily: T.sans, fontSize: '11px', letterSpacing: '0.28em', color: T.mute, fontWeight: 600 as const, textTransform: 'uppercase' as const, margin: '0 0 40px' }
const eyebrow = { fontFamily: T.sans, fontSize: '10px', letterSpacing: '0.32em', color: T.faint, fontWeight: 600 as const, textTransform: 'uppercase' as const, margin: '0 0 14px' }
const hed = { fontFamily: T.serif, fontSize: '40px', fontWeight: 400 as const, color: T.ink, letterSpacing: '-0.015em', lineHeight: 1.08, margin: '0 0 28px' }
const prose = { fontFamily: T.sans, fontSize: '15px', color: T.body, lineHeight: 1.65, margin: '0 0 18px' }
const proseSoft = { fontFamily: T.sans, fontSize: '13px', color: T.mute, lineHeight: 1.6, margin: '8px 0 0' }
const codeCard = { backgroundColor: T.panel, border: `1px solid ${T.panelEdge}`, borderRadius: 14, padding: '24px', margin: '24px 0 12px', textAlign: 'center' as const }
const codeText = { fontFamily: `'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`, fontSize: '32px', fontWeight: 500 as const, letterSpacing: '0.4em', color: T.ink, margin: 0 }
const rule = { border: 'none', borderTop: `1px solid ${T.hairline}`, margin: '36px 0 20px' }
const signoff = { fontFamily: T.serif, fontSize: '15px', color: T.mute, margin: '0 0 4px', fontStyle: 'italic' as const }
const footer = { fontFamily: T.sans, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: T.faint, fontWeight: 500 as const, margin: '8px 0 0' }
