/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { Shell, Hed, Prose, MetaCard, Cta, Note } from '../email-theme.tsx'

interface Props {
  teamName?: string
  inviterName?: string
  role?: string
  acceptUrl?: string
  expiresAt?: string
}

const ROLE_LINE: Record<string, string> = {
  admin: 'Admin — invite people, set roles, manage Team Projects.',
  member: 'Member — full Asherin with Pro-class limits, and Team Projects you belong to.',
  viewer: 'Viewer — read the shared Team Projects and published outputs.',
}

const TeamInviteEmail = ({
  teamName = 'a workspace',
  inviterName,
  role = 'member',
  acceptUrl = '#',
  expiresAt,
}: Props) => (
  <Shell preview={`You have been invited to ${teamName} on Asherin.`} eyebrow="Team">
    <Hed>You have a seat on {teamName}.</Hed>
    <Prose>
      {inviterName ? `${inviterName} invited you` : 'You have been invited'} to the{' '}
      <strong>{teamName}</strong> workspace on Asherin. The seat is already paid for by the
      workspace owner — you will not be asked for a card.
    </Prose>
    <MetaCard
      rows={[
        { label: 'Workspace', value: teamName },
        { label: 'Your role', value: ROLE_LINE[role] ?? role },
        ...(expiresAt ? [{ label: 'Invite expires', value: expiresAt }] : []),
      ]}
    />
    <Cta href={acceptUrl} label="Accept the invitation" />
    <Note>
      Sign in with this exact address to accept. Your own chats, vault items, keys and
      connections stay account-scoped — joining a workspace never shares them.
    </Note>
  </Shell>
)

export const template = {
  component: TeamInviteEmail,
  subject: (d: Record<string, any>) => `You have been invited to ${d?.teamName ?? 'a workspace'} on Asherin`,
  displayName: 'Team invitation',
  previewData: {
    teamName: 'Northgate Research',
    inviterName: 'The workspace owner',
    role: 'member',
    acceptUrl: 'https://asherin.com/dashboard?view=teams',
    expiresAt: 'in 14 days',
  },
} satisfies TemplateEntry
