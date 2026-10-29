import { useEffect, useState } from 'react'
import { useGarageDayAvailability } from '../../api/queries'
import { formatLongDate } from '../../lib/datetime'
import { formatMinutes } from '../../lib/addOns'
import {
  SLOT_STATUS,
  BUCKET_STEP_THRESHOLD,
  formatTimeRange,
  groupIntoHourBuckets,
} from '../../lib/availability'
import type { SlotBucket } from '../../lib/availability'

interface Props {
  slug: string
  date: string
  /** The chosen service's id - its duration determines which times are
   * offered (see app/public_booking/availability.py). Undefined for a
   * garage with no appointment types configured. */
  appointmentTypeId?: string
  /** Selected add-ons in `id:qty,...` form - they change the duration too. */
  addOns?: string
  selectedTime: string | null
  /** The start, and the server's end for the whole appointment. */
  onSelectSlot: (time: string, end?: string) => void
}

export function TimeSlotPicker({
  slug,
  date,
  appointmentTypeId,
  addOns,
  selectedTime,
  onSelectSlot,
}: Props) {
  const { data, isLoading, isError, refetch, isFetching } =
    useGarageDayAvailability(slug, date, appointmentTypeId, addOns)

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
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Times for {formatLongDate(date)}
        </h3>
        {isFetching && !isLoading && (
          <span className="text-xs text-slate-400">updating…</span>
        )}
      </div>
      {/* Explains why each time reads as a range: it is the whole job. */}
      {data?.duration_minutes != null && data.is_open && (
        <p className="mt-1 text-xs text-slate-600" data-testid="appointment-length">
          Appointment length: {formatMinutes(data.duration_minutes)}
        </p>
      )}

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
          <p className="mt-3 text-xs text-slate-500">
            These are start times, grouped by the hour. Choose when you'd like to start, then an
            exact start time.
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:max-h-[26rem] md:grid-cols-1 md:overflow-y-auto">
            {buckets.map((bucket) => {
              const meta = SLOT_STATUS[bucket.status]
              return (
                <li key={bucket.bucketStart}>
                  <button
                    type="button"
                    aria-disabled={!meta.selectable}
                    aria-label={`Starting between ${bucket.bucketStart} and ${bucket.bucketEnd}, ${meta.label}`}
                    onClick={() => meta.selectable && setOpenBucketStart(bucket.bucketStart)}
                    className={[
                      'flex w-full min-h-11 flex-col items-center justify-center rounded-md border px-2 py-1.5 text-sm transition',
                      meta.selectable
                        ? 'cursor-pointer border-slate-300 hover:border-slate-500'
                        : 'cursor-not-allowed border-slate-100 bg-slate-50',
                    ].join(' ')}
                  >
                    {/* Never a bare "10:00-11:00": for a 4-hour job that would
                        read as the appointment itself. */}
                    <span className="font-semibold">
                      Start {formatTimeRange(bucket.bucketStart, bucket.bucketEnd)}
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
            Starting {formatTimeRange(expandedBucket.bucketStart, expandedBucket.bucketEnd)}
          </span>
        </div>
      )}

      {visibleSlots.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:max-h-[26rem] md:grid-cols-1 md:overflow-y-auto">
          {visibleSlots.map((slot) => {
            const meta = SLOT_STATUS[slot.status]
            const isSelected = slot.start === selectedTime
            return (
              <li key={slot.start}>
                <button
                  type="button"
                  aria-disabled={!meta.selectable}
                  aria-pressed={isSelected}
                  aria-label={`${slot.end ? `${slot.start} to ${slot.end}` : slot.start}, ${meta.label}`}
                  onClick={() => meta.selectable && onSelectSlot(slot.start, slot.end)}
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
                  <span className="font-semibold tabular-nums">
                    {formatTimeRange(slot.start, slot.end)}
                  </span>
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
