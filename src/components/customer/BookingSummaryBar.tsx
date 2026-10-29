import { useId } from 'react'
import { formatMinutes, formatPence } from '../../lib/addOns'
import { formatTimeRange } from '../../lib/availability'

/** Space the page keeps clear at the bottom of the later steps so the bar
 * never sits over the step's own Back / Continue buttons. */
export const SUMMARY_BAR_RESERVED_SPACE = 'h-24'

/** "Mon 14 Sep" - short enough to share one line with price and time. */
function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * The slim, summary-only bar the later steps keep at the bottom of the
 * screen: what is being booked, its price and length, and - once picked -
 * the day and the appointment's whole span. It stays in view down a long
 * details form on a phone, which a banner at the top of the card did not.
 *
 * It only summarises: each step keeps its own Back / Continue. Change goes
 * back to the choice this step depends on (the service while picking a
 * time; the time after that), and is absent once nothing can change.
 */
export function BookingSummaryBar({
  serviceName,
  pricePence,
  minutes,
  date,
  time,
  timeEnd,
  onChange,
  changeLabel,
}: {
  serviceName: string
  /** Null when the service has no price - the bar says so rather than £0. */
  pricePence: number | null
  minutes: number | null
  date?: string
  time?: string
  timeEnd?: string
  onChange?: () => void
  /** Accessible name for Change, e.g. "Change time" - it starts with the
   * visible word so speech input still finds it. */
  changeLabel?: string
}) {
  const headingId = useId()
  const parts = [
    pricePence != null ? formatPence(pricePence) : 'Price confirmed by the business',
    minutes != null ? formatMinutes(minutes) : null,
    date && time ? `${shortDate(date)}, ${formatTimeRange(time, timeEnd)}` : null,
  ].filter(Boolean) as string[]

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      // Above page content, below the Modal / ConfirmDialog layer (z-50).
      className="fixed inset-x-0 bottom-0 z-40 sm:px-6"
      data-testid="booking-summary-bar"
    >
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-t-xl border border-b-0 border-slate-200 bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-6px_rgb(15_23_42/0.18)]">
        <div className="min-w-0 flex-1 text-sm">
          <p id={headingId} className="truncate font-semibold text-slate-900">
            {serviceName}
          </p>
          <p className="truncate text-slate-700" data-testid="summary-bar-details">
            {parts.map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="text-slate-500"> · </span>}
                <span className={i === 0 && pricePence != null ? 'font-semibold text-slate-900' : ''}>
                  {part}
                </span>
              </span>
            ))}
          </p>
        </div>
        {onChange && (
          <button
            type="button"
            onClick={onChange}
            aria-label={changeLabel}
            className="min-h-11 shrink-0 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Change
          </button>
        )}
      </div>
    </div>
  )
}
