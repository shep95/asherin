/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note, Subhed } from '../email-theme.tsx'

interface Flag {
  code?: string
  severity?: string
  detail?: string
  evidence?: string
}

interface Candidate {
  name?: string
  locality?: string
  basis?: string
  match_confidence?: number
}

interface Props {
  verdict?: string
  headline?: string
  driverName?: string
  plate?: string
  vehicle?: string
  city?: string
  platform?: string
  identityConfidence?: number
  narrative?: string
  recommendedAction?: string
  vehicleCheck?: string
  limits?: string
  flags?: Flag[]
  candidates?: Candidate[]
  reportUrl?: string
  generatedAt?: string
}

const RideshareReportEmail = ({
  verdict = 'THIN',
  headline = 'Driver assessment complete',
  driverName = 'not captured',
  plate = 'not captured',
  vehicle = 'not captured',
  city = 'not captured',
  platform = 'uber',
  identityConfidence = 0,
  narrative = '',
  recommendedAction = 'Verify the plate and driver photo against the app before you get in.',
  vehicleCheck = '',
  limits = 'Open sources only. Absence of record is not a clearance.',
  flags = [],
  candidates = [],
  reportUrl = 'https://asherin.com/dashboard',
  generatedAt = new Date().toUTCString(),
}: Props) => (
  <Shell preview={`${verdict} · ${headline}`} eyebrow="ASHERIN · RIDESHARE GUARDIAN">
    <Hed>{verdict} — {headline}</Hed>
    <Prose>{narrative || 'Assessment produced no narrative detail.'}</Prose>
    <MetaCard
      rows={[
        { label: 'Verdict', value: verdict },
        { label: 'Identity confidence', value: `${Math.round((identityConfidence || 0) * 100)}%` },
        { label: 'Platform', value: platform },
        { label: 'Driver', value: driverName },
        { label: 'Plate', value: plate },
        { label: 'Vehicle', value: vehicle },
        { label: 'City', value: city },
        { label: 'Generated', value: generatedAt },
      ]}
    />

    <Subhed>Do this now</Subhed>
    <Prose>{recommendedAction}</Prose>

    {candidates.length > 0 && (
      <>
        <Subhed>Candidate resolution ({candidates.length})</Subhed>
        <MetaCard
          rows={candidates.map((c) => ({
            label: `${Math.round((c.match_confidence || 0) * 100)}%`,
            value: `${c.name || 'unnamed'} — ${c.locality || 'locality unknown'}${c.basis ? ` — ${c.basis}` : ''}`,
          }))}
        />
      </>
    )}

    {flags.length > 0 && (
      <>
        <Subhed>Flags ({flags.length})</Subhed>
        <MetaCard
          rows={flags.map((f) => ({
            label: (f.severity || 'info').toUpperCase(),
            value: `${f.detail || ''}${f.evidence ? ` — evidence: ${f.evidence}` : ''}`,
          }))}
        />
      </>
    )}

    {vehicleCheck ? (
      <>
        <Subhed>Vehicle</Subhed>
        <Prose>{vehicleCheck}</Prose>
      </>
    ) : null}

    <Cta href={reportUrl} label="Open the full dossier" />
    <Note>
      Limits: {limits} This assessment is private to you, derived from public sources, and must
      not be republished or used for any employment decision. #houseofasher
    </Note>
  </Shell>
)

export const template = {
  component: RideshareReportEmail,
  subject: (d: Record<string, any>) =>
    `${d?.verdict ?? 'THIN'} · Rideshare Guardian — ${d?.driverName ?? 'your driver'}`,
  displayName: 'Rideshare Guardian report',
  previewData: {
    verdict: 'WATCH',
    headline: 'Plate on the card does not match the assigned vehicle',
    driverName: 'Marcus',
    plate: 'JHK 4820',
    vehicle: 'Toyota Camry',
    city: 'Atlanta, GA',
    platform: 'uber',
    identityConfidence: 0.61,
    narrative:
      'A driver matching the displayed first name and vehicle class resolves to one Atlanta-area candidate with moderate confidence. The plate captured from the trip card does not match the make recorded against that registration.',
    recommendedAction: 'Do not board until the plate on the car matches the plate in your app.',
    vehicleCheck: 'Make and model confirmed; plate could not be tied to the same vehicle record.',
    limits: 'Open sources only. No carrier, DMV, or law-enforcement systems were queried.',
    flags: [
      { code: 'PLATE_MISMATCH', severity: 'high', detail: 'Plate/vehicle inconsistency', evidence: 'Trip card vs public registration listing' },
    ],
    candidates: [
      { name: 'Marcus D.', locality: 'Atlanta, GA', basis: 'First name + metro + vehicle class', match_confidence: 0.61 },
    ],
    reportUrl: 'https://asherin.com/dashboard',
    generatedAt: 'Sat, 08 Aug 2026 00:45:00 GMT',
  },
} satisfies TemplateEntry
