import { useEffect, useState } from 'react'
import { useGarageDayAvailability } from '../../api/queries'
import { formatLongDate } from '../../lib/datetime'
import { SLOT_STATUS, BUCKET_STEP_THRESHOLD, groupIntoHourBuckets } from '../../lib/availability'
import type { SlotBucket } from '../../lib/availability'

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

  // Which hour bucket is expanded to its 5-minute slots, or null while the
  // customer is still choosing a bucket. Reset whenever a new day's slots
  // arrive, except that a bucket already containing the current selection
  // (e.g. stepping back to this screen) stays open.
  const [openBucketStart, setOpenBucketStart] = useState<string | null>(null)

  const useBuckets = (data?.slots.length ?? 0) > BUCKET_STEP_THRESHOLD
  const buckets = useBuckets ? groupIntoHourBuckets(data!.slots) : []

  useEffect(() => {
    if (!data || !useBuckets) {
      setOpenBucketStart(null)
      return
    }
    const containing = groupIntoHourBuckets(data.slots).find((b) =>
      b.slots.some((s) => s.start === selectedTime),
    )
    setOpenBucketStart(containing ? containing.bucketStart : null)
    // Only re-derive when the underlying data changes or the customer's
    // selection moves to a different bucket - not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, useBuckets, selectedTime])

  const expandedBucket: SlotBucket | undefined = buckets.find(
    (b) => b.bucketStart === openBucketStart,
  )
  const visibleSlots = useBuckets ? (expandedBucket?.slots ?? []) : (data?.slots ?? [])

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

      {useBuckets && !expandedBucket && buckets.length > 0 && (
        <>
          <p className="mt-3 text-xs text-slate-500">Choose a time window, then an exact time.</p>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {buckets.map((bucket) => {
              const meta = SLOT_STATUS[bucket.status]
              return (
                <li key={bucket.bucketStart}>
                  <button
                    type="button"
                    aria-disabled={!meta.selectable}
                    onClick={() => meta.selectable && setOpenBucketStart(bucket.bucketStart)}
                    className={[
                      'flex w-full min-h-11 flex-col items-center justify-center rounded-md border px-2 py-1.5 text-sm transition',
                      meta.selectable
                        ? 'cursor-pointer border-slate-300 hover:border-slate-500'
                        : 'cursor-not-allowed border-slate-100 bg-slate-50',
                    ].join(' ')}
                  >
                    <span className="font-semibold">
                      {bucket.bucketStart}–{bucket.bucketEnd}
                    </span>
                    <span className={`text-[11px] leading-none ${meta.pill}`}>{meta.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {useBuckets && expandedBucket && (
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOpenBucketStart(null)}
            className="text-xs font-medium text-slate-500 underline"
          >
            ← Back to time windows
          </button>
          <span className="text-xs text-slate-500">
            {expandedBucket.bucketStart}–{expandedBucket.bucketEnd}
          </span>
        </div>
      )}

      {visibleSlots.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleSlots.map((slot) => {
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
