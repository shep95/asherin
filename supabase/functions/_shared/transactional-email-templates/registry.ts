/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcome } from './welcome.tsx'
import { template as orderConfirmation } from './order-confirmation.tsx'
import { template as subscriptionRenewal } from './subscription-renewal.tsx'
import { template as securityAlert } from './security-alert.tsx'
import { template as paymentFailed } from './payment-failed.tsx'
import { template as invoiceReceipt } from './invoice-receipt.tsx'
import { template as newLoginDetected } from './new-login-detected.tsx'
import { template as passwordChanged } from './password-changed.tsx'
import { template as quotaWarning } from './quota-warning.tsx'
import { template as agentTaskComplete } from './agent-task-complete.tsx'
import { template as exportReady } from './export-ready.tsx'
import { template as accountDeletionScheduled } from './account-deletion-scheduled.tsx'
import { template as vcApplicationDecision } from './vc-application-decision.tsx'
import { template as vcApplicationForward } from './vc-application-forward.tsx'
import { template as zerlalScanReport } from './zerlal-scan-report.tsx'
import { template as zerlalCriticalAlert } from './zerlal-critical-alert.tsx'
import { template as subscriptionWelcome } from './subscription-welcome.tsx'
import { template as subscriptionEnding } from './subscription-ending.tsx'
import { template as forumDailyDigest } from './forum-daily-digest.tsx'
import { template as rideshareReport } from './rideshare-report.tsx'
import { template as intelligenceReport } from './intelligence-report.tsx'
import { template as teamInvite } from './team-invite.tsx'


export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome,
  'order-confirmation': orderConfirmation,
  'subscription-renewal': subscriptionRenewal,
  'security-alert': securityAlert,
  'payment-failed': paymentFailed,
  'invoice-receipt': invoiceReceipt,
  'new-login-detected': newLoginDetected,
  'password-changed': passwordChanged,
  'quota-warning': quotaWarning,
  'agent-task-complete': agentTaskComplete,
  'export-ready': exportReady,
  'account-deletion-scheduled': accountDeletionScheduled,
  'vc-application-decision': vcApplicationDecision,
  'vc-application-forward': vcApplicationForward,
  'zerlal-scan-report': zerlalScanReport,
  'zerlal-critical-alert': zerlalCriticalAlert,
  'subscription-welcome': subscriptionWelcome,
  'subscription-ending': subscriptionEnding,
  'forum-daily-digest': forumDailyDigest,
  'rideshare-report': rideshareReport,
  'intelligence-report': intelligenceReport,
  'team-invite': teamInvite,

}
