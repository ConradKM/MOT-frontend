import { apiFetch } from './client'

export interface PublicIncludedItem {
  label: string
  description: string | null
}

/** How a set of services is presented. GRID is image-led, for a business
 * where the customer is choosing a look and cannot judge the options from a
 * name; LIST is information-led, for one where the decision is made on price,
 * duration and description. */
export type DisplayMode = 'GRID' | 'LIST'

export interface PublicAppointmentType {
  id: string
  name: string
  description: string | null
  /** Decimal string from the backend (e.g. "54.85"), or null. */
  base_price: string | null
  default_duration_minutes: number | null
  /** Null for an ungrouped service. Membership is expressed here and only
   * here - groups carry no id lists, so the two can never disagree. */
  group_id: string | null
  order: number
  /** Short-lived presigned URL, or null - render a fallback, never a broken
   * image. Only shown in GRID mode. */
  image_url: string | null
  /** Customer-visible checklist steps only - see
   * ChecklistTemplateItem.visible_to_customer on the backend. */
  included_items: PublicIncludedItem[]
}

export interface PublicAppointmentTypeGroup {
  id: string
  name: string
  description: string | null
  order: number
  /** Already resolved against the business default by the server, so nothing
   * here has to implement the "null inherits" rule. */
  display_mode: DisplayMode
  image_url: string | null
}

export interface PublicGarage {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  /** The business-wide default; a group may override it. */
  booking_display_mode: DisplayMode
  /** Only groups with something active in them. */
  appointment_type_groups: PublicAppointmentTypeGroup[]
  /** Every active service, grouped or not, in display order. Partition on
   * `group_id` to render the groups. */
  appointment_types: PublicAppointmentType[]
}

/** Kept as an alias: the by-slug and by-id public garage lookups return the
 * same shape. */
export type PublicGarageDetail = PublicGarage

export interface BookingRequestInput {
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  /** Required - see app/phone.py. Accepts normal UK input; the server
   * normalises it to E.164 for storage. */
  customer_phone: string
  /** What the customer answered to this business's own configured questions
   * (see getBookingFlow). The server validates these against the workflow
   * that actually applies - what is sent here is never the authority. */
  answers?: BookingAnswerInput[]
  /** The service the customer chose - drives which times are offered (see
   * app/public_booking/availability.py). Null only for a garage with no
   * appointment types configured. */
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

// --- Booking workflow -----------------------------------------------------

/** What control to render, and how to validate the answer. DATE is a calendar
 * for a question of the business's own - distinct from the appointment date,
 * which the wizard always asks separately. */
export type BookingFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'CHECKBOX'
  | 'DATE'
  | 'TIME'
  | 'EMAIL'
  | 'PHONE'
  | 'PHOTO'

export interface BookingFlowField {
  id: string
  label: string
  help_text: string | null
  placeholder: string | null
  field_type: BookingFieldType
  is_required: boolean
  options: string[]
  min_value: number | null
  max_value: number | null
  max_length: number | null
}

export interface BookingFlowSection {
  id: string
  title: string
  description: string | null
  fields: BookingFlowField[]
}

export interface BookingFlow {
  appointment_type_id: string | null
  /** The *configured* part of the form only. "Your details" is built into the
   * wizard because the platform needs it to create the account and issue a
   * booking reference, so it is never in here. */
  sections: BookingFlowSection[]
}

export interface BookingAnswerInput {
  field_id: string
  value?: string | null
  values?: string[]
}

/** The questions this business asks for the chosen service. Resolved
 * server-side (business default, or the service's own override) so the form
 * and the submission validator can never disagree. */
export function getBookingFlow(slug: string, appointmentTypeId?: string): Promise<BookingFlow> {
  const qs = appointmentTypeId ? `?appointment_type_id=${appointmentTypeId}` : ''
  return apiFetch<BookingFlow>(`/api/public/${slug}/booking-flow${qs}`, { skipAuth: true })
}

export function getPublicGarage(id: string): Promise<PublicGarage> {
  return apiFetch<PublicGarage>(`/api/public/garages/${id}`, { skipAuth: true })
}

/** One garage + its active appointment types, keyed by the public slug. */
export function getPublicGarageBySlug(slug: string): Promise<PublicGarageDetail> {
  return apiFetch<PublicGarageDetail>(`/api/public/${slug}`, { skipAuth: true })
}

export interface BookingRequestCreated {
  id: string
  status: string
  /** Short reference to show on the confirmation screen and log in with. */
  booking_reference: string | null
}

export function submitBookingRequest(
  slug: string,
  data: BookingRequestInput,
): Promise<BookingRequestCreated> {
  return apiFetch<BookingRequestCreated>(`/api/public/${slug}/booking-requests`, {
    method: 'POST',
    body: data,
    skipAuth: true,
  })
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
  appointmentTypeId?: string,
): Promise<AvailabilityRange> {
  const qs = new URLSearchParams()
  if (from) qs.set('from', from)
  if (to) qs.set('to', to)
  // Without this each day's level is computed at the business's generic slot
  // length, so a long service can show a day as available and then offer no
  // times at all. The wizard picks the service first precisely so this can be
  // sent. See app/public_booking/availability.py::day_summary.
  if (appointmentTypeId) qs.set('appointment_type_id', appointmentTypeId)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<AvailabilityRange>(
    `/api/public/${slug}/availability${suffix}`,
    { skipAuth: true },
  )
}

export function getGarageDayAvailability(
  slug: string,
  date: string,
  appointmentTypeId?: string,
): Promise<DayAvailabilityDetail> {
  const qs = appointmentTypeId ? `?appointment_type_id=${appointmentTypeId}` : ''
  return apiFetch<DayAvailabilityDetail>(
    `/api/public/${slug}/availability/${date}${qs}`,
    { skipAuth: true },
  )
}
