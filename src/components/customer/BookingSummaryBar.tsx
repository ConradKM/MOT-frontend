import { useId } from 'react'
import { ArrowRight } from 'lucide-react'
import { formatMinutes, formatPence } from '../../lib/addOns'
import { formatTimeRange } from '../../lib/availability'

/** Space the page keeps clear at the bottom of the later steps so the bar
 * never sits over the step's own Back button. */
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
 * It also carries the step's forward action - Next, or Confirm Booking on
 * Review - so the way on is always in the same place, as on the Service
 * step's overlay. Back stays in the card. Change goes back to the choice
 * this step depends on (the service while picking a time; the time after
 * that), and is absent once nothing can change.
 */
export interface BarAction {
  label: string
  onClick: () => void
  /** Truly unavailable (e.g. no time picked yet, or submitting). */
  disabled?: boolean
  /** Looks unavailable but stays clickable so trying explains why (unticked
   * terms on Review). */
  softDisabled?: boolean
  /** Show the forward arrow - for Next, not for a final Confirm. */
  arrow?: boolean
  /** The final, booking-making action: green so it reads as "done", not
   * just another step. emerald-700 keeps white text above AA (5.5:1). */
  confirm?: boolean
}

export function BookingSummaryBar({
  serviceName,
  pricePence,
  minutes,
  date,
  time,
  timeEnd,
  onChange,
  changeLabel,
  action,
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
  /** The step's way forward; absent when the step has none of its own (a
   * deposit booking's Review, where the payment form is the next move). */
  action?: BarAction
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
            className="min-h-11 shrink-0 rounded-md px-2 text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          >
            Change
          </button>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            aria-disabled={action.softDisabled || undefined}
            data-variant={action.confirm ? 'confirm' : 'next'}
            className={`inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${
              action.confirm
                ? 'bg-emerald-700 hover:bg-emerald-800 focus-visible:outline-emerald-700'
                : 'bg-slate-900 hover:bg-slate-800 focus-visible:outline-slate-900'
            } ${action.softDisabled ? 'opacity-50' : ''}`}
          >
            {action.label}
            {action.arrow && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  )
}
