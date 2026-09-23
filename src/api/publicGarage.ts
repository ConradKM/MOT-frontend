import { apiFetch } from './client'
import type { DepositType } from '../types'

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
  /** Whether this service needs a deposit before a booking request is
   * submitted for review - drives whether the wizard shows the Deposit
   * step. The authoritative amount is still always recalculated
   * server-side when the deposit intent is created. */
  deposit_required: boolean
  deposit_type: DepositType | null
  deposit_value: string | null
  deposit_currency: string
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
  /** A fresh, short-lived download url each request, or null when the
   * business has no logo - render the text fallback on null, never a
   * broken-image icon. */
  logo_url: string | null
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
  /** Opaque browser-generated idempotency token for a deposit attempt. */
  payment_attempt_id?: string
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

// --- Deposits --------------------------------------------------------------

/** BookingRequest status while/after a deposit is being paid. */
export type DepositBookingStatus = 'AWAITING_PAYMENT' | 'PENDING' | 'EXPIRED'
/** BookingPayment status - see app/models/payments/payment.py. */
export type DepositPaymentStatus =
  | 'REQUIRES_PAYMENT'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

/** Which payment provider is handling this deposit - see
 * app/payments/providers/__init__.py::get_provider. New adapters can be
 * added on the backend without a frontend release breaking - an unknown
 * value here just means PaymentCheckout (see
 * src/components/customer/payments/PaymentCheckout.tsx) can't render a
 * checkout component for it yet and shows a clear fallback message. */
export type PaymentProviderName = 'stripe' | 'paypal' | 'square' | 'fake' | (string & {})

/** How the frontend should present the payment step for this session - see
 * app/payments/providers/base.py's CHECKOUT_MODE_* constants. */
export type CheckoutMode = 'EMBEDDED' | 'REDIRECT' | 'HOSTED'

export interface DepositIntentCreated {
  booking_request_id: string
  booking_reference: string | null
  status: DepositBookingStatus
  payment_status: DepositPaymentStatus | null
  currency: string | null
  /** Decimal strings - the service total may be null if the type has no
   * listed price (only possible for a FIXED deposit). */
  service_total: string | null
  deposit_amount: string | null
  remaining_balance: string | null
  provider: PaymentProviderName | null
  checkout_mode: CheckoutMode | null
  /** Provider-specific, client-safe fields only (e.g. Stripe's
   * client_secret + publishable_key + available_wallets) - shape depends on
   * `provider`/`checkout_mode`. Only present on creation, never on the
   * status-poll response - a fresh session token is only ever handed out
   * once. Never contains anything that isn't already safe to show a
   * customer. `available_wallets` (e.g. ["apple_pay", "google_pay"]) is
   * purely informational - the wallet buttons themselves are rendered by
   * the provider's own checkout widget (see StripeCheckout.tsx's
   * PaymentElement), never built by CoMaz. */
  provider_data: Record<string, string | string[] | null> | null
  /** Opaque server-issued recovery capability. It is safe to keep only in
   * sessionStorage and is never a Stripe credential. */
  recovery_token?: string | null
  hold_expires_at: string | null
}

export type DepositStatusPoll = Omit<
  DepositIntentCreated,
  'provider' | 'checkout_mode' | 'provider_data'
>

export interface RecoveredDepositAttempt extends DepositIntentCreated {
  appointment_type_id: string | null
  appointment_type_name: string | null
  preferred_date: string
  preferred_time: string | null
  requested_duration_minutes: number | null
  customer_first_name: string
  customer_last_name: string
  customer_email: string | null
  customer_phone: string | null
  vehicle_registration: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  vehicle_mileage: number | null
  answers: Array<{ field_id: string; value: string | null; values: string[] }>
}

export function createDepositIntent(
  slug: string,
  data: BookingRequestInput,
): Promise<DepositIntentCreated> {
  return apiFetch<DepositIntentCreated>(`/api/public/${slug}/booking-requests/deposit-intent`, {
    method: 'POST',
    body: data,
    skipAuth: true,
  })
}

export function getDepositStatus(
  slug: string,
  bookingReference: string,
): Promise<DepositStatusPoll> {
  return apiFetch<DepositStatusPoll>(
    `/api/public/${slug}/booking-requests/${bookingReference}/payment-status`,
    { skipAuth: true },
  )
}

/** Recover exactly one public payment attempt. The opaque token is posted,
 * never placed in a URL, and server state wins over any browser draft. */
export function recoverDepositAttempt(
  slug: string,
  recoveryToken: string,
): Promise<RecoveredDepositAttempt> {
  return apiFetch<RecoveredDepositAttempt>(
    `/api/public/${slug}/booking-requests/deposit-attempt/recover`,
    { method: 'POST', body: { recovery_token: recoveryToken }, skipAuth: true },
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
