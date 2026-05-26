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

export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome,
  'order-confirmation': orderConfirmation,
  'subscription-renewal': subscriptionRenewal,
  'security-alert': securityAlert,
  'payment-failed': paymentFailed,
}
