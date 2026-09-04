import type { Appointment } from '../types'
import type { GarageSchedule } from '../api/garageSchedule'
import { mondayIndex } from './datetime'

export interface PositionedAppointment {
  appointment: Appointment
  column: number
  columns: number
}

/** Lays out same-day appointments into side-by-side columns so overlapping ones don't collide. */
export function layoutOverlaps(appointments: Appointment[]): PositionedAppointment[] {
  const sorted = [...appointments].sort(
    (a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time),
  )
  const columns: Appointment[][] = []
  const placements: { appointment: Appointment; column: number }[] = []

  for (const appt of sorted) {
    const start = new Date(appt.start_time).getTime()
    let placedIn = -1
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      const last = col[col.length - 1]
      if (new Date(last.end_time).getTime() <= start) {
        col.push(appt)
        placedIn = i
        break
      }
    }
    if (placedIn === -1) {
      columns.push([appt])
      placedIn = columns.length - 1
    }
    placements.push({ appointment: appt, column: placedIn })
  }

  const totalColumns = Math.max(columns.length, 1)
  return placements.map((p) => ({
    appointment: p.appointment,
    column: p.column,
    columns: totalColumns,
  }))
}

/** Hour range to render, expanded to fit any out-of-hours appointments. */
export function hourRangeForAppointments(
  appointments: Appointment[],
  fallbackStart = 7,
  fallbackEnd = 19,
): [number, number] {
  let min = fallbackStart
  let max = fallbackEnd
  for (const a of appointments) {
    const s = new Date(a.start_time)
    const e = new Date(a.end_time)
    min = Math.min(min, s.getHours())
    max = Math.max(max, e.getMinutes() > 0 ? e.getHours() + 1 : e.getHours())
  }
  return [min, Math.max(max, min + 1)]
}

export interface DayHours {
  opensMin: number
  closesMin: number
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * The garage's effective opening hours for one calendar day (YYYY-MM-DD),
 * mirroring the backend's app/public_booking/availability.py::_day_hours -
 * an exception for that exact date wins, otherwise the weekday's normal row.
 *
 * Returns `undefined` while the schedule hasn't loaded yet (caller should not
 * assume closed), or `null` when the garage is genuinely closed that day.
 */
export function resolveDayHours(
  schedule: GarageSchedule | undefined,
  iso: string,
): DayHours | null | undefined {
  if (!schedule) return undefined

  const exception = schedule.exceptions.find((e) => e.date === iso)
  if (exception) {
    if (exception.is_closed) return null
    if (exception.opens_at && exception.closes_at) {
      return { opensMin: toMinutes(exception.opens_at), closesMin: toMinutes(exception.closes_at) }
    }
    // A non-closed exception with no explicit hours just means "open as
    // normal" - fall through to the weekday's regular hours.
  }

  const weekday = mondayIndex(iso) // 0 = Monday ... 6 = Sunday
  const row = schedule.opening_hours.find((h) => h.weekday === weekday)
  if (!row || row.is_closed) return null
  return { opensMin: toMinutes(row.opens_at), closesMin: toMinutes(row.closes_at) }
}

/** Hour range spanning every open column's hours, unioned with whatever
 * `hourRangeForAppointments` would show - so an appointment outside the
 * configured hours (a manual override) still renders instead of being
 * clipped off the grid. */
export function hourRangeForColumns(
  appointments: Appointment[],
  columnHours: (DayHours | null | undefined)[],
): [number, number] {
  const known = columnHours.filter((h): h is DayHours => !!h)
  const [apptStart, apptEnd] = hourRangeForAppointments(appointments)
  if (known.length === 0) return [apptStart, apptEnd]

  const scheduleStart = Math.min(...known.map((h) => Math.floor(h.opensMin / 60)))
  const scheduleEnd = Math.max(...known.map((h) => Math.ceil(h.closesMin / 60)))
  const min = Math.min(apptStart, scheduleStart)
  const max = Math.max(apptEnd, scheduleEnd)
  return [min, Math.max(max, min + 1)]
}
