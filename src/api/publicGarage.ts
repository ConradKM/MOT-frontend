import { apiFetch } from './client'

export interface PublicGarage {
  id: string
  name: string
  slug: string
}

export interface PublicAppointmentType {
  id: string
  name: string
  description: string | null
  /** Decimal string from the backend (e.g. "54.85"), or null. */
  base_price: string | null
  default_duration_minutes: number | null
}

export interface PublicGarageDetail extends PublicGarage {
  appointment_types: PublicAppointmentType[]
}

export interface BookingRequestInput {
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_phone?: string | null
  vehicle_registration: string
  vehicle_make?: string | null
  vehicle_model?: string | null
  vehicle_year?: number | null
  vehicle_mileage?: number | null
  appointment_type_id?: string | null
  preferred_date: string
  preferred_time?: string | null
  preferred_employee_note?: string | null
  notes?: string | null
  captcha_token?: string
}

export function getPublicGarages(): Promise<PublicGarage[]> {
  // Trailing slash is required: the backend only registers `/api/public/garages/`,
  // so the slash-less path 308-redirects to an absolute backend-origin URL that the
  // browser then follows straight past the dev proxy and gets CORS-blocked. See #9.
  return apiFetch<PublicGarage[]>('/api/public/garages/', { skipAuth: true })
}

export function getPublicGarage(id: string): Promise<PublicGarage> {
  return apiFetch<PublicGarage>(`/api/public/garages/${id}`, { skipAuth: true })
}

/** One garage + its active appointment types, keyed by the public slug. */
export function getPublicGarageBySlug(slug: string): Promise<PublicGarageDetail> {
  return apiFetch<PublicGarageDetail>(`/api/public/${slug}`, { skipAuth: true })
}

export function submitBookingRequest(
  slug: string,
  data: BookingRequestInput,
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(
    `/api/public/${slug}/booking-requests`,
    { method: 'POST', body: data, skipAuth: true },
  )
}

// --- Availability calendar ------------------------------------------------

/** How busy a whole day is. `full` also covers "open but nothing bookable". */
export type DayLevel = 'available' | 'limited' | 'full' | 'closed' | 'past'
export type SlotStatus = 'available' | 'limited' | 'booked'

export interface AvailabilityRules {
  slot_interval_minutes: number
  min_lead_time_hours: number
  max_advance_days: number
  /** YYYY-MM-DD */
  booking_window_start: string
  /** YYYY-MM-DD */
  booking_window_end: string
}

export interface OpeningHoursEntry {
  /** 0 = Monday … 6 = Sunday */
  weekday: number
  opens_at: string
  closes_at: string
  is_closed: boolean
}

export interface DayAvailability {
  /** YYYY-MM-DD */
  date: string
  weekday: number
  is_open: boolean
  level: DayLevel
  open_slots: number
  total_slots: number
}

export interface AvailabilityRange {
  garage: { slug: string; name: string }
  rules: AvailabilityRules
  opening_hours: OpeningHoursEntry[]
  days: DayAvailability[]
}

export interface AvailabilitySlot {
  /** "HH:MM" */
  start: string
  status: SlotStatus
  remaining: number
  capacity: number
}

export interface DayAvailabilityDetail {
  date: string
  is_open: boolean
  level: DayLevel
  slots: AvailabilitySlot[]
}

export function getGarageAvailability(
  slug: string,
  from?: string,
  to?: string,
): Promise<AvailabilityRange> {
  const qs = new URLSearchParams()
  if (from) qs.set('from', from)
  if (to) qs.set('to', to)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<AvailabilityRange>(
    `/api/public/${slug}/availability${suffix}`,
    { skipAuth: true },
  )
}

export function getGarageDayAvailability(
  slug: string,
  date: string,
): Promise<DayAvailabilityDetail> {
  return apiFetch<DayAvailabilityDetail>(
    `/api/public/${slug}/availability/${date}`,
    { skipAuth: true },
  )
}
