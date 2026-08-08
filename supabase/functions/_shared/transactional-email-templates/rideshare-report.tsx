/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note, Subhed } from '../email-theme.tsx'

// ═══════════════════════════════════════════════════════════════════════════
// RIDESHARE GUARDIAN — CURBSIDE ALERT
//
// Deliberately NOT the dossier. Mail is plaintext at rest on infrastructure
// the rider does not control, is trivially forwarded, and for autopilot users
// lands in the same mailbox the trip receipts are read from. A resolved
// identity, candidate matches and evidence links for a named private person
// must not be sitting there in perpetuity.
//
// This carries only what is actionable in the ten seconds before a car door
// opens: the verdict, the vehicle to expect, and the instruction. The full
// assessment stays behind an authenticated session.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  verdict?: string
  headline?: string
  plate?: string
  vehicle?: string
  platform?: string
  recommendedAction?: string
  flagCount?: number
  flagSeverity?: string
  reportUrl?: string
  generatedAt?: string
}

const flagLine = (count: number, severity: string): string => {
  if (!count) return 'No flags raised.'
  const noun = count === 1 ? 'flag' : 'flags'
  return severity === 'high'
    ? `${count} ${noun} raised, including at least one high-severity item. Read it before you board.`
    : `${count} ${noun} raised. Review them in the dossier.`
}

const RideshareReportEmail = ({
  verdict = 'THIN',
  headline = 'Driver assessment complete',
  plate = 'not captured',
  vehicle = 'not captured',
  platform = 'uber',
  recommendedAction = 'Verify the plate and driver photo against the app before you get in.',
  flagCount = 0,
  flagSeverity = 'none',
  reportUrl = 'https://asherin.com/dashboard',
  generatedAt = new Date().toUTCString(),
}: Props) => (
  <Shell preview={`${verdict} · ${headline}`} eyebrow="ASHERIN · RIDESHARE GUARDIAN">
    <Hed>{verdict} — {headline}</Hed>

    <Subhed>Do this now</Subhed>
    <Prose>{recommendedAction}</Prose>

    <MetaCard
      rows={[
        { label: 'Verdict', value: verdict },
        { label: 'Expect', value: `${vehicle} · plate ${plate}` },
        { label: 'Platform', value: platform },
        { label: 'Flags', value: flagLine(flagCount || 0, flagSeverity || 'none') },
        { label: 'Generated', value: generatedAt },
      ]}
    />

    <Cta href={reportUrl} label="Open the full dossier" />

    <Note>
      The assessment itself — identity resolution, candidates, evidence and sourcing — is held in
      your account and is not sent by email. Open sources only; absence of record is not a
      clearance. Private to you, and not to be republished or used for any employment decision.
      #houseofasher
    </Note>
  </Shell>
)

export const template = {
  component: RideshareReportEmail,
  subject: (d: Record<string, any>) =>
    `${d?.verdict ?? 'THIN'} · Rideshare Guardian — your ${d?.platform ?? 'ride'} driver`,
  displayName: 'Rideshare Guardian alert',
  previewData: {
    verdict: 'WATCH',
    headline: 'Plate on the card does not match the assigned vehicle',
    plate: 'JHK 4820',
    vehicle: 'Toyota Camry',
    platform: 'uber',
    recommendedAction: 'Do not board until the plate on the car matches the plate in your app.',
    flagCount: 1,
    flagSeverity: 'high',
    reportUrl: 'https://asherin.com/dashboard?tab=cloud-intel&module=rideshare',
    generatedAt: 'Sat, 08 Aug 2026 00:45:00 GMT',
  },
} satisfies TemplateEntry
