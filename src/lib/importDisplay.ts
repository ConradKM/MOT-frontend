import type { AppointmentFlag, AppointmentNormalised, ImportItem, ImportResult } from '../types'

/** Wording for an import preview, shared by its components. */

/** One-line summary, also what the live region announces. */
export function summarise(result: ImportResult): string {
  const { counts } = result
  const parts = [
    `${counts.new} new`,
    `${counts.exists} already exist${counts.exists === 1 ? 's' : ''}`,
    `${counts.error} with errors`,
    `${counts.warning} with warnings`,
  ]
  return parts.join(', ')
}

export const FLAG_LABEL: Record<AppointmentFlag, string> = {
  past: 'In the past',
  clash: 'Double-booked',
  over_capacity: 'Over capacity',
  out_of_hours: 'Outside opening hours',
}

export function hasProblem(item: ImportItem): boolean {
  return item.status === 'ERROR' || item.warnings.length > 0
}

/** "Mon 7 Jan 2030, 10:00–11:00", read straight off the server's local ISO
 * strings so the browser's own timezone can never shift a booking. */
export function formatWhen(appointment: AppointmentNormalised): string {
  if (!appointment.start) return 'Time unreadable'
  const day = new Date(`${appointment.start.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const start = appointment.start.slice(11, 16)
  const end = appointment.end ? `–${appointment.end.slice(11, 16)}` : ''
  return `${day}, ${start}${end}`
}

