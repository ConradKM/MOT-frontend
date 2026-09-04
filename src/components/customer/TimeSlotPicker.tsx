import { useGarageDayAvailability } from '../../api/queries'
import { formatLongDate } from '../../lib/datetime'
import { SLOT_STATUS } from '../../lib/availability'

interface Props {
  slug: string
  date: string
  /** The chosen service's id - its duration determines which times are
   * offered (see app/public_booking/availability.py). Undefined for a
   * garage with no appointment types configured. */
  appointmentTypeId?: string
  selectedTime: string | null
  onSelectSlot: (time: string) => void
}

export function TimeSlotPicker({
  slug,
  date,
  appointmentTypeId,
  selectedTime,
  onSelectSlot,
}: Props) {
  const { data, isLoading, isError, refetch, isFetching } =
    useGarageDayAvailability(slug, date, appointmentTypeId)

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Times for {formatLongDate(date)}
        </h3>
        {isFetching && !isLoading && (
          <span className="text-xs text-slate-400">updating…</span>
        )}
      </div>

      {isLoading && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-3 text-sm text-red-700">
          Couldn't load times.{' '}
          <button
            type="button"
            onClick={() => refetch()}
            className="font-medium underline"
          >
            Try again
          </button>
        </p>
      )}

      {data && !isLoading && !data.is_open && (
        <p className="mt-3 text-sm text-slate-500">
          The garage is closed on this day. Please pick another date.
        </p>
      )}

      {data && !isLoading && data.is_open && data.slots.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">
          No times are still available on this day. Please pick another date.
        </p>
      )}

      {data && data.slots.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.slots.map((slot) => {
            const meta = SLOT_STATUS[slot.status]
            const isSelected = slot.start === selectedTime
            return (
              <li key={slot.start}>
                <button
                  type="button"
                  aria-disabled={!meta.selectable}
                  aria-pressed={isSelected}
                  aria-label={`${slot.start} — ${meta.label}`}
                  onClick={() => meta.selectable && onSelectSlot(slot.start)}
                  className={[
                    'flex w-full min-h-11 flex-col items-center justify-center rounded-md border px-2 py-1.5 text-sm transition',
                    meta.selectable
                      ? 'cursor-pointer border-slate-300 hover:border-slate-500'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50',
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : '',
                  ].join(' ')}
                >
                  <span className="font-semibold">{slot.start}</span>
                  <span
                    className={`text-[11px] leading-none ${
                      isSelected ? 'text-slate-200' : meta.pill
                    }`}
                  >
                    {meta.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
