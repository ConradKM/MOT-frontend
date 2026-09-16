import { apiFetch } from './client'

export interface StripeConnectStatus {
  provider: string | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
}

export function getStripeConnectStatus(): Promise<StripeConnectStatus> {
  return apiFetch('/api/payments/stripe/status')
}

export function startStripeConnect(): Promise<{ url: string }> {
  return apiFetch('/api/payments/stripe/connect', { method: 'POST' })
}
