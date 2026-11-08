import { apiFetch } from './client'
import type { Garage } from '../types'

/** The caller's own business record. */
export function getGarage(): Promise<Garage> {
  return apiFetch<Garage>('/api/garage')
}

/** The business's effective plan features (`GET /api/garage/features`):
 * its plan's defaults with any Platform Admin override applied. */
export interface GarageFeatures {
  plan: string
  features: Record<string, boolean>
}

export function getGarageFeatures(): Promise<GarageFeatures> {
  return apiFetch<GarageFeatures>('/api/garage/features')
}

/**
 * The subset of business fields an OWNER may edit (`PATCH /api/garage`). The
 * backend allowlist is exactly these six; `slug`, `id`, `layout_variant` and
 * every system field are rejected. STAFF get 403.
 */
export type GarageDetailsPatch = Partial<
  Pick<Garage, 'name' | 'email' | 'phone' | 'address' | 'postcode' | 'website'>
>

export function updateGarage(patch: GarageDetailsPatch): Promise<Garage> {
  return apiFetch<Garage>('/api/garage', { method: 'PATCH', body: patch })
}

/** Both set, or both null to reset to the default look. OWNER only; 422 with
 * the measured ratio when the pair's contrast is under 4.5:1. */
export interface BookingAppearanceInput {
  booking_background_color: string | null
  booking_text_color: string | null
}

export function updateBookingAppearance(input: BookingAppearanceInput): Promise<Garage> {
  return apiFetch<Garage>('/api/garage/booking-appearance', { method: 'PUT', body: input })
}

export function updateBookingRequestSettings(auto_accept_booking_requests: boolean): Promise<Garage> {
  return apiFetch<Garage>('/api/garage/booking-request-settings', {
    method: 'PUT',
    body: { auto_accept_booking_requests },
  })
}

export function updateBookingRequestAutoAccept(auto_accept_booking_requests_enabled: boolean): Promise<Garage> {
  return apiFetch<Garage>('/api/garage/booking-request-settings/auto-accept', {
    method: 'PUT',
    body: { auto_accept_booking_requests_enabled },
  })
}
