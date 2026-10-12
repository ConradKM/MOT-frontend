import type { CalendarFeed } from '../api/calendarExport'
import type { AppointmentType, Employee } from '../types'
import { addDaysIso, weekDatesIso } from './datetime'
import { employeeNameById } from './employees'

/** Mirrors the API's CALENDAR_EXPORT_MAX_DAYS so the dialog can say so before
 * the request; the server's 422 remains the real limit. */
export const MAX_DOWNLOAD_DAYS = 366

export type DownloadPreset = 'today' | 'week' | 'next30' | 'custom'

export const DOWNLOAD_PRESETS: { value: DownloadPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'next30', label: 'Next 30 days' },
  { value: 'custom', label: 'Custom' },
]

/** A subscription has no fixed end - it is a rolling window around today. */
export const DAYS_BACK_OPTIONS = [0, 7, 30]
export const DAYS_FORWARD_OPTIONS = [30, 90, 180, 365]

export interface DateRange {
  start: string
  end: string
}

/** The inclusive date range a preset covers, relative to `today` (YYYY-MM-DD). */
export function presetRange(preset: Exclude<DownloadPreset, 'custom'>, today: string): DateRange {
  if (preset === 'today') return { start: today, end: today }
  if (preset === 'week') {
    const week = weekDatesIso(today)
    return { start: week[0], end: week[6] }
  }
  return { start: today, end: addDaysIso(today, 29) }
}

/** Inclusive day count of a YYYY-MM-DD range (1 for a single day). */
export function rangeDays({ start, end }: DateRange): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)
  return Math.round(ms / 86_400_000) + 1
}

/** A message when a range can't be downloaded, otherwise null. */
export function downloadRangeError(range: DateRange): string | null {
  if (!range.start || !range.end) return 'Choose a start and end date.'
  if (range.start > range.end) return 'The start date must be on or before the end date.'
  if (rangeDays(range) > MAX_DOWNLOAD_DAYS) {
    return `Choose a range of at most ${MAX_DOWNLOAD_DAYS} days.`
  }
  return null
}

export function daysBackLabel(days: number): string {
  return days === 0 ? 'none' : `${days} days`
}

/** "Sam Spanner, Ada Lovelace +2 more" - short enough for a list row. */
function namesSummary(names: string[], max = 2): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`
}

/** One line saying what a feed contains, e.g.
 * "All workers · 2 appointment types · last 7 days to next 90 days". */
export function feedScopeSummary(
  feed: CalendarFeed,
  employees: Employee[] | undefined,
  appointmentTypes: AppointmentType[] | undefined,
): string {
  const whose =
    feed.scope === 'ALL'
      ? 'All workers'
      : feed.scope === 'ME'
        ? employeeNameById(employees, feed.created_by_employee_id)
        : namesSummary(feed.employee_ids.map((id) => employeeNameById(employees, id)))

  let types = 'All appointment types'
  if (feed.appointment_type_ids !== null) {
    const names = feed.appointment_type_ids.map(
      (id) => appointmentTypes?.find((t) => t.id === id)?.name ?? 'Unknown type',
    )
    types = namesSummary(names)
  }

  const window =
    feed.days_back === 0
      ? `today to next ${feed.days_forward} days`
      : `last ${feed.days_back} days to next ${feed.days_forward} days`

  return `${whose} · ${types} · ${window}`
}
