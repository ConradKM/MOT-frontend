import type { QueueDashboard, QueueEntryStatus } from '../api/queue'

export const QUEUE_STATUS_LABELS: Record<QueueEntryStatus, string> = {
  WAITING: 'Waiting',
  CALLED: 'Called',
  IN_SERVICE: 'Being served',
  DONE: 'Done',
  CANCELLED: 'Left the queue',
  NO_SHOW: 'No-show',
}

/** "Now", "about 25 min", "about 1 hr 20 min" - deliberately approximate. */
export function formatWait(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes <= 0) return 'Now'
  if (minutes < 60) return `about ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `about ${hours} hr` : `about ${hours} hr ${rest} min`
}

/** Whole minutes from `nowIso` to `iso`, rounded up and floored at 0 -
 * measured against the server's `now` so a skewed device clock can't
 * distort it. Null in, null out. */
export function minutesUntil(iso: string | null, nowIso: string): number | null {
  if (!iso) return null
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.parse(nowIso)) / 60_000))
}

/** `ids` with `id` moved `delta` places (clamped). Used for the dashboard's
 * up/down reorder buttons - no drag-and-drop library. */
export function moveId(ids: string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id)
  if (from === -1) return ids
  const to = Math.min(ids.length - 1, Math.max(0, from + delta))
  if (to === from) return ids
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

// --- The walk-in's token -----------------------------------------------------
//
// Kept per business so reopening the queue page (or the QR code) finds the
// place you already hold. Storage can be unavailable (private mode, blocked
// site data) - every access is guarded and the page still works from the
// link's fragment alone.

function tokenKey(garageId: string): string {
  return `comaz:queue-token:${garageId}`
}

export function readStoredQueueToken(garageId: string): string | null {
  try {
    return window.localStorage.getItem(tokenKey(garageId))
  } catch {
    return null
  }
}

export function storeQueueToken(garageId: string, token: string): void {
  try {
    window.localStorage.setItem(tokenKey(garageId), token)
  } catch {
    // Non-fatal: the status link still carries the token.
  }
}

export function clearStoredQueueToken(garageId: string): void {
  try {
    window.localStorage.removeItem(tokenKey(garageId))
  } catch {
    // Nothing to clear.
  }
}

/** The token from a status link's fragment (`#<token>`), or null. */
export function tokenFromHash(hash: string): string | null {
  const token = hash.replace(/^#/, '').trim()
  return token.length > 0 ? token : null
}

// --- One timeline for the staff dashboard -----------------------------------

export interface TimelineItem {
  key: string
  /** ISO start - actual, scheduled or estimated. Null: can't be seen today. */
  time: string | null
  kind: 'appointment' | 'walk-in'
  title: string
  detail: string
  /** Walk-in: queue status. Appointment: appointment status. */
  status: string
  estimated: boolean
}

/**
 * Today's scheduled appointments and the live walk-ins merged into one
 * chronological list - so staff can see the queue *against* the bookings
 * it competes with. A walk-in already checked in appears once, as its
 * appointment; waiting walk-ins sit at their estimated start.
 */
export function buildTimeline(dashboard: QueueDashboard): TimelineItem[] {
  const items: TimelineItem[] = dashboard.appointments.map((a) => ({
    key: `appt:${a.id}`,
    time: a.start_time,
    kind: a.is_walk_in ? 'walk-in' : 'appointment',
    title: a.customer_name,
    detail: [a.appointment_type_name, a.employee_name].filter(Boolean).join(' · '),
    status: a.status,
    estimated: false,
  }))
  for (const e of dashboard.entries) {
    if (e.status !== 'WAITING' && e.status !== 'CALLED') continue
    items.push({
      key: `entry:${e.id}`,
      time: e.status === 'CALLED' ? (e.called_at ?? dashboard.now) : e.estimated_start_at,
      kind: 'walk-in',
      title: `#${e.ticket_number} ${e.customer_first_name}`,
      // The row itself is already labelled "Walk-in" - don't say it twice.
      detail: [e.appointment_type_name ?? 'Service not chosen', `${e.service_minutes} min`].join(
        ' · ',
      ),
      status: e.status,
      estimated: e.status === 'WAITING',
    })
  }
  return items.sort((a, b) => {
    if (a.time === b.time) return 0
    if (a.time === null) return 1
    if (b.time === null) return -1
    return a.time < b.time ? -1 : 1
  })
}
