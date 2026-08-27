import type { Appointment } from '../types'

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
