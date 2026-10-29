import { useId, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { PublicAppointmentType } from '../../api/publicGarage'
import { AddOnOptions } from '../addOns/AddOnPicker'
import {
  addOnTotals,
  formatMinutes,
  formatPence,
  selectionCount,
  toPence,
  type AddOnOption,
  type AddOnSelection,
} from '../../lib/addOns'
import { serviceMinutes } from '../../lib/availability'
import { AnimatedValue } from './AnimatedValue'

/** Space the page keeps clear at the bottom of the Service step so the
 * collapsed bar never sits over the last service. The add-on panel is
 * allowed to overlay content - it is the customer's own, open, choice. */
export const SUMMARY_OVERLAY_RESERVED_SPACE = 'h-40'

/** "2 hours 30 minutes" - spelled out for the screen-reader summary. */
function spokenMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const parts = []
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`)
  if (m || !h) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`)
  return parts.join(' ')
}

/**
 * The bar that rises from the bottom of the Service step once a service is
 * picked: the add-ons that can go with it, the running price and total time,
 * and Next - the only way on to Date & time. Picking a service or an add-on
 * never navigates by itself.
 *
 * Totals here are what the server will check: the time is the service's
 * `effective_duration_minutes` (the business's default when the service
 * has none) plus add-on minutes, the same sum availability uses.
 */
export function BookingSummaryOverlay({
  service,
  addOns,
  selection,
  onChangeAddOns,
  onNext,
}: {
  service: PublicAppointmentType
  addOns: AddOnOption[]
  selection: AddOnSelection
  onChangeAddOns: (next: AddOnSelection) => void
  onNext: () => void
}) {
  const headingId = useId()
  const panelId = useId()
  // Open to begin with so the extras are noticed; the customer can fold it
  // away to see the services behind it.
  const [addOnsOpen, setAddOnsOpen] = useState(true)

  const extra = addOnTotals(selection, addOns)
  const count = selectionCount(selection)
  const basePence = service.base_price != null ? toPence(service.base_price) : null
  const totalPence = basePence != null ? basePence + extra.pricePence : null
  const baseMinutes = serviceMinutes(service)
  const totalMinutes = baseMinutes != null ? baseMinutes + extra.minutes : null

  const spoken = [
    totalPence != null ? `Total ${formatPence(totalPence)}` : 'Price confirmed by the business',
    totalMinutes != null ? spokenMinutes(totalMinutes) : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      // Above page content, below the Modal / ConfirmDialog layer (z-50).
      className="animate-overlay-in fixed inset-x-0 bottom-0 z-40 sm:px-6"
      data-testid="booking-summary-overlay"
    >
      <div className="mx-auto w-full max-w-2xl rounded-t-xl border border-b-0 border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-6px_rgb(15_23_42/0.18)]">
        {addOns.length > 0 && (
          <div className="border-b border-slate-100">
            <button
              type="button"
              onClick={() => setAddOnsOpen((o) => !o)}
              aria-expanded={addOnsOpen}
              aria-controls={panelId}
              className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-sm"
            >
              <span className="font-medium text-slate-900">
                Add-ons{' '}
                <span className="font-normal text-slate-600">
                  {count > 0 ? `· ${count} selected` : '· optional'}
                </span>
              </span>
              <svg
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform motion-reduce:transition-none ${
                  addOnsOpen ? '' : 'rotate-180'
                }`}
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              id={panelId}
              inert={!addOnsOpen}
              aria-hidden={!addOnsOpen}
              className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                addOnsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="max-h-[50dvh] overflow-y-auto px-1 pb-2">
                  <AddOnOptions addOns={addOns} value={selection} onChange={onChangeAddOns} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p id={headingId} className="truncate text-sm font-semibold text-slate-900">
              {service.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-slate-700" aria-hidden="true">
              {totalPence != null ? (
                <AnimatedValue compare={totalPence} className="font-semibold text-slate-900">
                  <span data-testid="summary-price">{formatPence(totalPence)}</span>
                </AnimatedValue>
              ) : (
                <span data-testid="summary-price">Price confirmed by the business</span>
              )}
              {totalMinutes != null && (
                <>
                  <span className="text-slate-500">·</span>
                  <AnimatedValue compare={totalMinutes}>
                    <span data-testid="summary-time">{formatMinutes(totalMinutes)}</span>
                  </AnimatedValue>
                </>
              )}
            </p>
            {/* One polite announcement per change with the settled totals,
                instead of the animated text above. */}
            <p className="sr-only" aria-live="polite" data-testid="summary-live">
              {spoken}
            </p>
          </div>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Next
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
