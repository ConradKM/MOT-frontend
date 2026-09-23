import { apiFetch } from './client'

export interface StripeConnectStatus {
  provider: string | null
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
  /** Null until stripe_charges_enabled - see app/payments/connect.py::
   * get_wallet_domain_status. Registering the domain doesn't mean Apple Pay
   * is immediately usable; Stripe verifies it asynchronously. */
  apple_pay_status: string | null
  apple_pay_status_details: string | null
}

export function getStripeConnectStatus(): Promise<StripeConnectStatus> {
  return apiFetch('/api/payments/stripe/status')
}

export function startStripeConnect(): Promise<{ url: string }> {
  return apiFetch('/api/payments/stripe/connect', { method: 'POST' })
}
