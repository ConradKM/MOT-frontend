const pad = (n: number) => String(n).padStart(2, '0')

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
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
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
