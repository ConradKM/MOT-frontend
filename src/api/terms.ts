import { apiFetch } from './client'
import type { AppliedAddOn } from '../types'

/** The caller's business's Terms & Conditions (app/terms on the backend). */
export interface GarageTerms {
  /** Null when the business has none - terms are then switched off. */
  terms_and_conditions: string | null
  terms_version: number | null
  /** When the current wording was saved, i.e. took effect. */
  terms_updated_at: string | null
}

export function getGarageTerms(): Promise<GarageTerms> {
  return apiFetch<GarageTerms>('/api/garage/terms')
}

/** OWNER only (403 otherwise). Empty text turns terms off; unchanged text
 * keeps the current version, so customers aren't re-prompted. */
export function updateGarageTerms(terms_and_conditions: string): Promise<GarageTerms> {
  return apiFetch<GarageTerms>('/api/garage/terms', {
    method: 'PUT',
    body: { terms_and_conditions },
  })
}

/** One wording of a business's terms, for the public Terms page. */
export interface PublicTerms {
  garage_id: string
  garage_name: string
  logo_url: string | null
  version: number
  /** Plain text - render as text, never HTML. */
  body: string
  effective_at: string
  /** False on an old version a confirmation linked to. */
  is_current: boolean
}

/** The current terms, or - with `version` - one exact wording (what booking
 * confirmations link to). 404 when there are none / no such version. */
export function getPublicTerms(garageId: string, version?: string): Promise<PublicTerms> {
  const path = version
    ? `/api/public/garages/${garageId}/terms/${version}`
    : `/api/public/garages/${garageId}/terms`
  return apiFetch<PublicTerms>(path, { skipAuth: true })
}

// --- Accepting terms for a WhatsApp/SMS/phone booking -----------------------

export type TermsAcceptanceState = 'AWAITING_ACCEPTANCE' | 'ACCEPTED' | 'EXPIRED' | 'CLOSED'

export interface TermsAcceptanceBooking {
  booking_reference: string | null
  customer_first_name: string
  service_name: string | null
  add_ons: AppliedAddOn[]
  preferred_date: string
  preferred_time: string | null
  duration_minutes: number | null
  price: string | null
  vehicle_registration: string | null
  /** Accepting continues into paying a deposit. */
  deposit_required: boolean
}

export interface TermsAcceptanceLookup {
  state: TermsAcceptanceState
  status: string
  garage_id: string
  garage_name: string
  booking: TermsAcceptanceBooking
  /** The *current* terms - only while there is still something to accept. */
  terms_and_conditions: string | null
  terms_version: number | null
  hold_expires_at: string | null
}

export interface TermsAccepted {
  /** PENDING, or AWAITING_PAYMENT for a deposit booking. */
  status: string
  booking_reference: string | null
  /** Deposit bookings only: the booking page's own recovery capability, to
   * continue straight into the existing checkout. */
  recovery_token: string | null
}

// The token is posted in the body, never put in an API URL - it arrives in
// the page URL's fragment, which browsers never send to a server.
export function lookupTermsAcceptance(slug: string, token: string): Promise<TermsAcceptanceLookup> {
  return apiFetch<TermsAcceptanceLookup>(`/api/public/${slug}/terms-acceptance/lookup`, {
    method: 'POST',
    body: { token },
    skipAuth: true,
  })
}

export function acceptTerms(
  slug: string,
  token: string,
  termsVersion: number | null,
): Promise<TermsAccepted> {
  return apiFetch<TermsAccepted>(`/api/public/${slug}/terms-acceptance/accept`, {
    method: 'POST',
    body: { token, terms_accepted: true, terms_version: termsVersion },
    skipAuth: true,
  })
}

/** `errors.reason` codes the API uses for terms conflicts. */
export const TERMS_VERSION_MISMATCH = 'terms_version_mismatch'
