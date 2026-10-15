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

// --- Provider selection -----------------------------------------------------

export type SelectablePaymentProvider = 'stripe' | 'square'

export interface PaymentProviderSelection {
  /** The business's active provider for new deposits. Can be another
   * adapter name (e.g. a deployment default) until the owner chooses. */
  provider: string
  options: Array<{ name: SelectablePaymentProvider; ready: boolean }>
}

export function getPaymentProvider(): Promise<PaymentProviderSelection> {
  return apiFetch('/api/payments/provider')
}

/** 409 (reason `payment_in_progress`) while a customer is mid-checkout. */
export function setPaymentProvider(
  provider: SelectablePaymentProvider,
): Promise<PaymentProviderSelection> {
  return apiFetch('/api/payments/provider', { method: 'PUT', body: { provider } })
}

// --- Square -------------------------------------------------------------------

export type SquareConnectionState = 'NOT_CONNECTED' | 'CONNECTED' | 'REVOKED' | 'ERROR'

export interface SquareLocation {
  id: string
  name: string | null
  currency: string | null
  can_take_card_payments: boolean
  /** Active, card-capable and in the business's currency - only these can be chosen. */
  eligible: boolean
}

/** Never carries a token - see app/payments/schemas.py::SquareConnectStatusSchema. */
export interface SquareConnectStatus {
  status: SquareConnectionState
  merchant_id: string | null
  merchant_name: string | null
  location_id: string | null
  location_name: string | null
  locations: SquareLocation[]
  can_take_card_payments: boolean
  currency: string
  charges_in_currency: boolean
  ready: boolean
  environment: 'sandbox' | 'production'
  /** False when CoMaz itself hasn't configured its Square application yet. */
  deployment_configured: boolean
}

export function getSquareConnectStatus(): Promise<SquareConnectStatus> {
  return apiFetch('/api/payments/square/status')
}

/** Square's own authorisation page - the caller redirects the browser to it. */
export function startSquareConnect(): Promise<{ url: string }> {
  return apiFetch('/api/payments/square/connect', { method: 'POST' })
}

export function setSquareLocation(locationId: string): Promise<SquareConnectStatus> {
  return apiFetch('/api/payments/square/location', {
    method: 'PUT',
    body: { location_id: locationId },
  })
}

export function disconnectSquare(): Promise<{
  disconnected: boolean
  remote_revoke_confirmed: boolean
}> {
  return apiFetch('/api/payments/square/disconnect', { method: 'POST' })
}
