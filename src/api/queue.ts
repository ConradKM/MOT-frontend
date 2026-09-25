import { apiFetch } from './client'

/**
 * Walk-in queue - see MOT-backend app/queueing.
 *
 * Position and ETA are never stored server-side: every read recomputes them
 * from the live queue plus the day's appointments, so polling is all it takes
 * to stay current.
 */

export type QueueEntryStatus =
  | 'WAITING'
  | 'CALLED'
  | 'IN_SERVICE'
  | 'DONE'
  | 'CANCELLED'
  | 'NO_SHOW'

/** Machine-readable reason a join is refused - `errors.reason` on a 409. */
export type QueueRefusalReason =
  | 'queue_closed'
  | 'closed_today'
  | 'past_closing'
  | 'full_for_today'

// --- Public (no account) ----------------------------------------------------

export interface PublicQueueInfo {
  garage_name: string
  is_open: boolean
  accepting_joins: boolean
  refusal_reason: QueueRefusalReason | null
  refusal_message: string | null
  waiting_count: number
  /** Where a new walk-in would land right now. Null when not accepting. */
  estimated_start_at: string | null
  estimated_wait_minutes: number | null
  opens_at: string | null
  closes_at: string | null
}

export interface PublicQueueStatus {
  garage_name: string
  queue_is_open: boolean
  ticket_number: number
  status: QueueEntryStatus
  end_reason: string | null
  customer_first_name: string
  /** Only while WAITING. */
  position: number | null
  people_ahead: number | null
  estimated_start_at: string | null
  estimated_wait_minutes: number | null
  /** False when the estimate runs past closing time. */
  fits_today: boolean | null
  called_at: string | null
  call_expires_at: string | null
}

export interface QueueJoined extends PublicQueueStatus {
  /** Returned exactly once - the customer's only key to their place. */
  token: string
}

export interface QueueJoinInput {
  customer_first_name: string
  customer_last_name?: string | null
  /** UK mobile, any normal format - normalised server-side. */
  customer_phone: string
  sms_opt_in: boolean
  vehicle_registration?: string | null
  appointment_type_id?: string | null
  notes?: string | null
  captcha_token?: string
}

export function getPublicQueue(slug: string): Promise<PublicQueueInfo> {
  return apiFetch<PublicQueueInfo>(`/api/public/${slug}/queue`, { skipAuth: true })
}

export function joinQueue(slug: string, data: QueueJoinInput): Promise<QueueJoined> {
  return apiFetch<QueueJoined>(`/api/public/${slug}/queue/join`, {
    method: 'POST',
    body: data,
    skipAuth: true,
  })
}

/** POST, not GET: the token goes in the body so it never lands in a URL
 * that a proxy or access log would record. */
export function getQueueStatus(slug: string, token: string): Promise<PublicQueueStatus> {
  return apiFetch<PublicQueueStatus>(`/api/public/${slug}/queue/status`, {
    method: 'POST',
    body: { token },
    skipAuth: true,
  })
}

export function leaveQueue(slug: string, token: string): Promise<PublicQueueStatus> {
  return apiFetch<PublicQueueStatus>(`/api/public/${slug}/queue/cancel`, {
    method: 'POST',
    body: { token },
    skipAuth: true,
  })
}

// --- Staff --------------------------------------------------------------------

export interface QueueEntry {
  id: string
  status: QueueEntryStatus
  end_reason: string | null
  ticket_number: number
  customer_first_name: string
  customer_last_name: string | null
  customer_phone: string
  sms_opt_in: boolean
  vehicle_registration: string | null
  notes: string | null
  appointment_type_id: string | null
  appointment_type_name: string | null
  service_minutes: number
  joined_at: string
  called_at: string | null
  started_at: string | null
  ended_at: string | null
  appointment_id: string | null
  position: number | null
  estimated_start_at: string | null
  estimated_wait_minutes: number | null
  fits_today: boolean | null
  call_expires_at: string | null
}

export interface TimelineAppointment {
  id: string
  start_time: string
  end_time: string
  status: string
  customer_name: string
  appointment_type_name: string | null
  employee_name: string | null
  /** True for the appointment a walk-in was promoted into at check-in. */
  is_walk_in: boolean
}

export type AverageSource = 'MANUAL' | 'AUTO' | 'DEFAULT'

export interface QueueAverage {
  effective_minutes: number
  source: AverageSource
  auto_minutes: number | null
  auto_sample_size: number
}

export interface QueueDashboard {
  now: string
  service_date: string
  is_open: boolean
  accepting_joins: boolean
  refusal_reason: QueueRefusalReason | null
  refusal_message: string | null
  capacity: number
  opens_at: string | null
  closes_at: string | null
  no_show_timeout_minutes: number | null
  average: QueueAverage
  new_joiner_estimated_start_at: string | null
  new_joiner_fits_today: boolean
  /** Today's entries, active and finished, in queue order. */
  entries: QueueEntry[]
  appointments: TimelineAppointment[]
}

export type AverageMode = 'AUTO' | 'MANUAL'

export interface QueueSettings {
  is_open: boolean
  average_mode: AverageMode
  manual_average_minutes: number | null
  no_show_timeout_minutes: number | null
  default_appointment_type_id: string | null
  average: QueueAverage
  /** Bays serving at once - the booking calendar's own shared number. */
  capacity: number
  /** The schedule setting behind `capacity`; null = employee count. */
  capacity_per_slot: number | null
}

export type QueueSettingsInput = Partial<
  Pick<
    QueueSettings,
    | 'is_open'
    | 'average_mode'
    | 'manual_average_minutes'
    | 'no_show_timeout_minutes'
    | 'default_appointment_type_id'
  >
>

export interface ReservedWindow {
  id: string
  /** 0 = Monday … 6 = Sunday, for a weekly window; null for a one-off. */
  weekday: number | null
  /** YYYY-MM-DD for a one-off window; null for a weekly one. */
  date: string | null
  starts_at: string
  ends_at: string
  reserved_capacity: number
  note: string | null
}

export type ReservedWindowInput = Omit<ReservedWindow, 'id'>

export function getQueueDashboard(): Promise<QueueDashboard> {
  return apiFetch<QueueDashboard>('/api/queue')
}

export function openQueue(): Promise<QueueDashboard> {
  return apiFetch<QueueDashboard>('/api/queue/open', { method: 'POST' })
}

export function closeQueue(): Promise<QueueDashboard> {
  return apiFetch<QueueDashboard>('/api/queue/close', { method: 'POST' })
}

export function callNext(): Promise<QueueEntry> {
  return apiFetch<QueueEntry>('/api/queue/call-next', { method: 'POST' })
}

export type QueueEntryAction = 'call' | 'start' | 'complete' | 'no-show' | 'cancel'

export function queueEntryAction(id: string, action: QueueEntryAction): Promise<QueueEntry> {
  return apiFetch<QueueEntry>(`/api/queue/entries/${id}/${action}`, {
    method: 'POST',
    // Check-in takes optional employee/service overrides; the defaults
    // (the member of staff checking them in, the service they picked) are
    // what the dashboard uses.
    body: action === 'start' ? {} : undefined,
  })
}

export function reorderQueue(entryIds: string[]): Promise<QueueDashboard> {
  return apiFetch<QueueDashboard>('/api/queue/order', {
    method: 'PUT',
    body: { entry_ids: entryIds },
  })
}

export function getQueueSettings(): Promise<QueueSettings> {
  return apiFetch<QueueSettings>('/api/queue/settings')
}

export function updateQueueSettings(data: QueueSettingsInput): Promise<QueueSettings> {
  return apiFetch<QueueSettings>('/api/queue/settings', { method: 'PUT', body: data })
}

export function listReservedWindows(): Promise<ReservedWindow[]> {
  return apiFetch<ReservedWindow[]>('/api/queue/reserved-windows')
}

export function addReservedWindow(data: ReservedWindowInput): Promise<ReservedWindow> {
  return apiFetch<ReservedWindow>('/api/queue/reserved-windows', { method: 'POST', body: data })
}

export function deleteReservedWindow(id: string): Promise<void> {
  return apiFetch<void>(`/api/queue/reserved-windows/${id}`, { method: 'DELETE' })
}
