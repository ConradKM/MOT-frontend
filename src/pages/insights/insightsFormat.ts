import { addDaysIso, addMonthsIso, daysInMonth, startOfMonthIso, startOfWeekIso, todayIso } from '../../lib/datetime'

export type RangePreset = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'custom'

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'custom', label: 'Custom' },
]

/** The longest period the API accepts (MAX_PERIOD_DAYS on the backend). */
export const MAX_RANGE_DAYS = 730

export interface DateRange {
  start: string
  end: string
}

/** Inclusive local dates for a preset. `custom` is the caller's own range. */
export function rangeFor(preset: Exclude<RangePreset, 'custom'>, today = todayIso()): DateRange {
  switch (preset) {
    case 'last7':
      return { start: addDaysIso(today, -6), end: today }
    case 'last30':
      return { start: addDaysIso(today, -29), end: today }
    case 'last90':
      return { start: addDaysIso(today, -89), end: today }
    case 'thisMonth':
      return { start: startOfMonthIso(today), end: today }
    case 'lastMonth': {
      const start = addMonthsIso(startOfMonthIso(today), -1)
      return { start, end: addDaysIso(start, daysInMonth(start) - 1) }
    }
  }
}

/** Monday to Sunday of the current week - the Dashboard's "This week" card. */
export function thisWeek(today = todayIso()): DateRange {
  const start = startOfWeekIso(today)
  return { start, end: addDaysIso(start, 6) }
}

export function rangeDays({ start, end }: DateRange): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1
}

/** Why a custom range can't be requested, or null when it's fine. */
export function rangeError(range: DateRange): string | null {
  if (!range.start || !range.end) return 'Choose a start and an end date.'
  if (range.end < range.start) return 'The end date must be on or after the start date.'
  if (rangeDays(range) > MAX_RANGE_DAYS) return `A period can be at most ${MAX_RANGE_DAYS} days.`
  return null
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export function formatGbp(value: string | undefined): string {
  return value === undefined ? '—' : GBP.format(Number(value))
}

/** A rate that can honestly be "nothing to divide by". */
export function formatRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? 'n/a' : `${rate}%`
}

export type Trend = 'up' | 'down' | 'flat' | 'none'

export interface Delta {
  trend: Trend
  /** Plain-language comparison, e.g. "+12% vs previous 30 days". */
  text: string
}

/**
 * The change from the previous period. Counts and money compare as a
 * percentage change; rates (already percentages) compare in points, since
 * "+50%" of a 2% no-show rate would mislead. No previous value, or a
 * previous zero for a percentage change, gives "n/a" rather than "+∞%".
 */
export function delta(
  current: number | null | undefined,
  previous: number | null | undefined,
  { days, kind = 'count' }: { days: number; kind?: 'count' | 'rate' },
): Delta {
  const suffix = `vs previous ${days} day${days === 1 ? '' : 's'}`
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return { trend: 'none', text: `n/a ${suffix}` }
  }
  const diff = current - previous
  const trend: Trend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  if (kind === 'rate') {
    const points = Math.round(diff * 10) / 10
    return { trend, text: `${points > 0 ? '+' : ''}${points} pts ${suffix}` }
  }
  if (previous === 0) {
    return current === 0 ? { trend, text: `No change ${suffix}` } : { trend, text: `New this period (${suffix})` }
  }
  const pct = Math.round((diff / previous) * 100)
  return { trend, text: `${pct > 0 ? '+' : ''}${pct}% ${suffix}` }
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

/** "Tue 3 Mar" for a day bucket, "w/c 2 Mar" for a week, "Mar 2026" for a month. */
export function bucketLabel(isoDate: string, granularity: 'day' | 'week' | 'month'): string {
  const date = new Date(`${isoDate}T12:00:00`)
  if (granularity === 'month') {
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }
  const short = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  if (granularity === 'week') return `w/c ${short}`
  return `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${short}`
}

export const SOURCE_LABELS: Record<string, string> = {
  web: 'Online booking',
  conversation: 'WhatsApp / phone assistant',
  queue: 'Walk-in queue',
  import: 'Imported',
  staff: 'Added by staff',
}

/** The plain-language definitions behind every metric's info tip. */
export const DEFINITIONS = {
  bookedValue:
    'The price of completed appointments that started in this period, after add-ons and discounts. It is the value of work done, not money in the bank - most of it is paid in person.',
  deposits:
    'Online deposits actually taken in this period, minus anything refunded.',
  appointments:
    'Every appointment starting in this period, whatever happened to it - booked, completed, no-show or cancelled.',
  newCustomers:
    "Customers whose first completed visit with you was in this period - even if they've already been back since.",
  returningRate:
    'Of the customers you saw in this period, the share who had also visited before it started.',
  noShowRate:
    "No-shows out of appointments that either went ahead or were missed. Upcoming bookings and cancellations don't count either way.",
  dueBack:
    "Worked out per service: the customer's last completed visit plus that service's \"customers usually return after\" setting, or the vehicle's MOT expiry for services set to use it. People with a booking already coming up aren't listed.",
  heatmap: 'When appointments start, by day of the week and hour. Cancelled bookings are left out.',
  rateNa: 'n/a means there was nothing to measure yet - for example no appointments had finished.',
} as const
