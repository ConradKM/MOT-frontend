const pad = (n: number) => String(n).padStart(2, '0')

// Pinned explicitly everywhere below rather than relying on the runtime's
// default locale ([]) - that default happens to already be UK-ish in this
// dev environment, but a production host is not guaranteed to have the same
// OS/ICU locale, and this app's UI should read the same (UK-friendly) way
// regardless of where it's deployed. Internal/API values stay ISO - this is
// presentation only.
const UK_LOCALE = 'en-GB'

// Built by hand (not read from Intl) so every month is a consistent 3
// letters - en-GB's own Intl data abbreviates September as "Sept" while
// every other month is 3 letters, which is inconsistent for a table column.
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Today's date as YYYY-MM-DD, in the browser's local timezone. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ISO 8601 datetime (with offset) -> value for an <input type="datetime-local">. */
export function isoToLocalInputValue(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value -> ISO 8601 datetime with the browser's local UTC offset. */
export function localInputValueToIso(value: string): string {
  if (!value) return value
  const d = new Date(value)
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hh = pad(Math.floor(abs / 60))
  const mm = pad(abs % 60)
  return `${value}:00${sign}${hh}:${mm}`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(UK_LOCALE, { hour: '2-digit', minute: '2-digit' })
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`
}

/** "14 Sep 2026" — the default table-cell/list date format used throughout
 * the app (Customers, Appointments, Requests, MOT history, ...). Accepts a
 * full ISO datetime or a bare YYYY-MM-DD date. */
export function formatDateShort(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`
}

/** "14/09/2026" — compact numeric form for tight spaces. */
export function formatDateNumeric(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** "14 Sep 2026, 09:05" */
export function formatDateTime(iso: string): string {
  return `${formatDateShort(iso)}, ${formatTime(iso)}`
}

/** YYYY-MM-DD of an ISO datetime, in the browser's local timezone. */
export function localDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM-DD, shifted by `delta` days (local calendar days). */
export function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** YYYY-MM-DD for the Monday of the week containing `iso`. */
export function startOfWeekIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addDaysIso(iso, mondayOffset)
}

/** The 7 YYYY-MM-DD dates (Mon-Sun) for the week containing `iso`. */
export function weekDatesIso(iso: string): string[] {
  const monday = startOfWeekIso(iso)
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i))
}

/** YYYY-MM-01 of the month containing `iso`. */
export function startOfMonthIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/** YYYY-MM-01, shifted by `delta` whole months. */
export function addMonthsIso(iso: string, delta: number): string {
  const d = new Date(`${startOfMonthIso(iso)}T00:00:00`)
  d.setMonth(d.getMonth() + delta)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

/** Weekday of `iso` as 0 = Monday … 6 = Sunday. */
export function mondayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00`).getDay() + 6) % 7
}

/** Number of days in the month containing `iso`. */
export function daysInMonth(iso: string): number {
  const d = new Date(`${startOfMonthIso(iso)}T00:00:00`)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/** "September 2026" for the month containing `iso`. */
export function monthLabel(iso: string): string {
  return new Date(`${startOfMonthIso(iso)}T00:00:00`).toLocaleDateString(UK_LOCALE, {
    month: 'long',
    year: 'numeric',
  })
}

/** "Thursday, 14 September 2026" — full month names are unambiguous, so this
 * one can safely use Intl rather than a hand-built table. */
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(UK_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "Thu 17 Sep" — compact form for chips / calendar headers (no year). */
export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${WEEKDAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`
}
