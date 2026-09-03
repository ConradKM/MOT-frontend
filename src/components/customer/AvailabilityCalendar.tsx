import { useEffect, useMemo, useRef, useState } from 'react'
import { useGarageAvailability } from '../../api/queries'
import type { DayAvailability } from '../../api/publicGarage'
import {
  addDaysIso,
  addMonthsIso,
  daysInMonth,
  formatLongDate,
  mondayIndex,
  monthLabel,
  startOfMonthIso,
  todayIso,
} from '../../lib/datetime'
import { DAY_LEVELS, LEGEND_LEVELS } from '../../lib/availability'

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ARROW_DELTAS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
}

interface Props {
  slug: string
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

function isoFor(month: string, day: number): string {
  return `${month.slice(0, 7)}-${String(day).padStart(2, '0')}`
}

function clamp(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min
  if (max && iso > max) return max
  return iso
}

export function AvailabilityCalendar({ slug, selectedDate, onSelectDate }: Props) {
  const { data, isLoading, isError, refetch, isFetching } =
    useGarageAvailability(slug)

  const byDate = useMemo(() => {
    const m = new Map<string, DayAvailability>()
    data?.days.forEach((d) => m.set(d.date, d))
    return m
  }, [data])

  const windowStart = data?.rules.booking_window_start
  const windowEnd = data?.rules.booking_window_end

  const [month, setMonth] = useState(() =>
    startOfMonthIso(selectedDate ?? todayIso()),
  )
  const [focusDate, setFocusDate] = useState<string | null>(selectedDate)
  const gridRef = useRef<HTMLDivElement>(null)

  // Snap into the booking window once the rules load.
  useEffect(() => {
    if (windowStart && month < startOfMonthIso(windowStart)) {
      setMonth(startOfMonthIso(windowStart))
    } else if (windowEnd && month > startOfMonthIso(windowEnd)) {
      setMonth(startOfMonthIso(windowEnd))
    }
  }, [windowStart, windowEnd, month])

  // Move DOM focus to the roving cell after arrow-key navigation.
  useEffect(() => {
    if (!focusDate) return
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)
      ?.focus()
  }, [focusDate, month])

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg border border-slate-200 p-4">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-14 rounded bg-slate-100" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn't load availability.{' '}
        <button
          type="button"
          onClick={() => refetch()}
          className="font-medium underline"
        >
          Try again
        </button>
      </div>
    )
  }

  const monthStart = startOfMonthIso(month)
  const canPrev = !windowStart || monthStart > startOfMonthIso(windowStart)
  const canNext = !windowEnd || monthStart < startOfMonthIso(windowEnd)
  const leadingBlanks = mondayIndex(monthStart)
  const totalDays = daysInMonth(monthStart)

  const activeRovingDate =
    focusDate && focusDate.slice(0, 7) === month.slice(0, 7)
      ? focusDate
      : selectedDate && selectedDate.slice(0, 7) === month.slice(0, 7)
        ? selectedDate
        : isoFor(monthStart, 1)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = ARROW_DELTAS[e.key]
    if (!delta) return
    e.preventDefault()
    const next = clamp(
      addDaysIso(activeRovingDate, delta),
      windowStart,
      windowEnd,
    )
    if (next.slice(0, 7) !== month.slice(0, 7)) setMonth(startOfMonthIso(next))
    setFocusDate(next)
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(addMonthsIso(month, -1))}
          disabled={!canPrev}
          aria-label="Previous month"
          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
        >
          ‹
        </button>
        <h3
          className="text-sm font-semibold text-slate-900"
          aria-live="polite"
        >
          {monthLabel(month)}
          {isFetching && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              updating…
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => setMonth(addMonthsIso(month, 1))}
          disabled={!canNext}
          aria-label="Next month"
          className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div
        className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400"
        aria-hidden="true"
      >
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`Availability for ${monthLabel(month)}`}
        onKeyDown={handleKeyDown}
        className="mt-1 grid grid-cols-7 gap-1.5"
      >
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} aria-hidden="true" />
        ))}

        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
          const iso = isoFor(monthStart, day)
          const avail = byDate.get(iso)
          const outOfWindow = !avail
          const level = avail?.level ?? 'past'
          const style = DAY_LEVELS[level]
          const selectable = !outOfWindow && style.selectable
          const isSelected = iso === selectedDate
          const label = outOfWindow
            ? `${formatLongDate(iso)} — not bookable`
            : `${formatLongDate(iso)} — ${style.label}${
                selectable ? ', selectable' : ''
              }`

          return (
            <button
              key={iso}
              type="button"
              data-date={iso}
              role="gridcell"
              aria-label={label}
              aria-disabled={!selectable}
              aria-pressed={isSelected}
              tabIndex={iso === activeRovingDate ? 0 : -1}
              onClick={() => {
                setFocusDate(iso)
                if (selectable) onSelectDate(iso)
              }}
              className={[
                'flex h-14 flex-col items-center justify-center rounded-md border text-sm transition',
                outOfWindow
                  ? 'cursor-default border-transparent text-slate-300'
                  : style.cell,
                selectable ? 'cursor-pointer' : 'cursor-not-allowed',
                isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : '',
              ].join(' ')}
            >
              <span className="font-semibold">{day}</span>
              {!outOfWindow && (
                <span className="mt-0.5 text-[10px] leading-none">
                  {style.icon && <span aria-hidden="true">{style.icon} </span>}
                  {level === 'available'
                    ? 'Open'
                    : level === 'limited'
                      ? 'Few left'
                      : level === 'full'
                        ? 'Full'
                        : 'Closed'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {LEGEND_LEVELS.map((lvl) => (
          <li key={lvl} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${DAY_LEVELS[lvl].swatch}`}
              aria-hidden="true"
            />
            {DAY_LEVELS[lvl].icon && (
              <span aria-hidden="true">{DAY_LEVELS[lvl].icon}</span>
            )}
            {DAY_LEVELS[lvl].label}
          </li>
        ))}
      </ul>
    </div>
  )
}
