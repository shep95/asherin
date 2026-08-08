import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'HouseOfAsher Ventures'

interface Props {
  founderName?: string
  companyName?: string
  approved?: boolean
  rationale?: string
}

const VCDecisionEmail = ({ founderName, companyName, approved, rationale }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {approved
        ? `Your application to ${SITE_NAME} has advanced`
        : `An update on your ${SITE_NAME} application`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>◈ HOUSEOFASHER VENTURES</Text>
        <Heading style={h1}>
          {approved
            ? `Congratulations, ${founderName || 'Founder'}`
            : `Decision on your application`}
        </Heading>

        {approved ? (
          <>
            <Text style={text}>
              Your application for <strong>{companyName || 'your venture'}</strong> has
              successfully passed Asherin's multi-phase analytical review and has earned
              the attention of the Senate of HouseOfAsher.
            </Text>
            <Text style={text}>
              A member of our team will contact you directly to schedule the next phase
              of due diligence. Please prepare verifiable supporting documentation —
              financial models, traction metrics, and architectural materials — for the
              follow-up review.
            </Text>
          </>
        ) : (
          <>
            <Text style={text}>
              Thank you for submitting <strong>{companyName || 'your venture'}</strong> to
              HouseOfAsher Ventures. After running your application through Asherin's
              multi-phase analytical review, we are unable to advance it to the Senate
              for investment consideration at this time.
            </Text>
            {rationale && (
              <Section style={rationaleBox}>
                <Text style={rationaleLabel}>AUREON ADVISORY NOTES</Text>
                <Text style={rationaleText}>{rationale}</Text>
              </Section>
            )}
            <Text style={text}>
              This is not a permanent rejection. We encourage you to strengthen the
              flagged areas — particularly around quantifiable traction, defensible
              moat, and financial integrity — and reapply when material changes
              warrant a new review.
            </Text>
          </>
        )}

        <Hr style={hr} />
        <Text style={footer}>— The Senate of {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VCDecisionEmail,
  subject: (data: Record<string, any>) =>
    data?.approved
      ? `Your ${SITE_NAME} application has advanced`
      : `Decision on your ${SITE_NAME} application`,
  displayName: 'VC application decision',
  previewData: {
    founderName: 'Jane Doe',
    companyName: 'Acme Labs',
    approved: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '40px 32px', maxWidth: '600px', margin: '0 auto' }
const brand = { fontSize: '11px', letterSpacing: '0.25em', color: '#111111', fontWeight: 600, margin: '0 0 24px' }
const h1 = { fontSize: '24px', fontWeight: 300, color: '#000000', margin: '0 0 24px', letterSpacing: '-0.01em' }
const text = { fontSize: '14px', color: '#444444', lineHeight: '1.6', margin: '0 0 18px' }
const rationaleBox = { backgroundColor: '#f6f6f6', border: '1px solid #eeeeee', borderRadius: '8px', padding: '16px 18px', margin: '18px 0' }
const rationaleLabel = { fontSize: '10px', letterSpacing: '0.18em', color: '#777777', margin: '0 0 8px', fontWeight: 600 }
const rationaleText = { fontSize: '13px', color: '#333333', lineHeight: '1.55', margin: 0, whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#eeeeee', margin: '32px 0 18px' }
const footer = { fontSize: '11px', color: '#999999', letterSpacing: '0.08em', margin: 0 }
