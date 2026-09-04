import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Appointment } from '../types'
import {
  type DayHours,
  hourRangeForColumns,
  layoutOverlaps,
} from '../lib/calendarLayout'
import { statusBadgeClass } from '../lib/appointmentStatuses'
import { formatTime } from '../lib/datetime'
import { useGarageId } from '../hooks/useGarageId'
import { useAppointmentStatuses } from '../api/queries'

export interface CalendarColumn {
  key: string
  label: ReactNode
  appointments: Appointment[]
  /** The garage's opening hours for whatever this column represents (a date,
   * for Week view; the one day being shown, for Day view) - `null` means
   * closed all day, `undefined` means "not known yet" (e.g. still loading).
   * Used to shade out-of-hours time so the grid reads as a real working-day
   * calendar - shown, and visually distinguishable from bookable time - even
   * with zero appointments, rather than rendering nothing at all. */
  hours?: DayHours | null
}

interface Props {
  columns: CalendarColumn[]
  customerName: (id: string) => string
  appointmentTypeName: (id: string) => string
}

const HOUR_HEIGHT = 56
const GUTTER_WIDTH = 48
// Small enough that a full working week fits a normal desktop viewport
// without horizontal scrolling, while still leaving room for a readable
// appointment card; genuinely narrow screens still scroll (the wrapper below
// keeps overflow-x-auto for that).
const COLUMN_MIN_WIDTH = 96

function minutesFromStart(iso: string, startHour: number): number {
  const d = new Date(iso)
  return (d.getHours() - startHour) * 60 + d.getMinutes()
}

export function TimeGridCalendar({ columns, customerName, appointmentTypeName }: Props) {
  const garageId = useGarageId()
  const { data: statusConfig } = useAppointmentStatuses()
  const allAppointments = columns.flatMap((c) => c.appointments)
  const [startHour, endHour] = hourRangeForColumns(
    allAppointments,
    columns.map((c) => c.hours),
  )
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT
  const gridTop = startHour * 60

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${GUTTER_WIDTH}px repeat(${columns.length}, minmax(${COLUMN_MIN_WIDTH}px, 1fr))`,
        }}
      >
        <div className="border-b border-r border-slate-200" />
        {columns.map((col) => (
          <div
            key={col.key}
            className={`border-b border-r border-slate-200 px-2 py-2 text-center text-xs font-medium last:border-r-0 ${
              col.hours === null ? 'bg-slate-50 text-slate-400' : 'text-slate-600'
            }`}
          >
            {col.label}
            {col.hours === null && <span className="block font-normal">Closed</span>}
          </div>
        ))}

        <div className="relative border-r border-slate-200" style={{ height: gridHeight }}>
          {hours.map((h) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[11px] text-slate-400"
              style={{ top: (h - startHour) * HOUR_HEIGHT }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {columns.map((col) => {
          const positioned = layoutOverlaps(col.appointments)
          return (
            <div
              key={col.key}
              className="relative border-r border-slate-200 last:border-r-0"
              style={{ height: gridHeight }}
            >
              {/* Out-of-hours shading - closed all day, or before opening / after
                  closing - so free-but-bookable time reads differently from time
                  that was never available in the first place. */}
              {col.hours === null && (
                <div className="absolute inset-0 bg-slate-50" aria-hidden />
              )}
              {col.hours && col.hours.opensMin > gridTop && (
                <div
                  className="absolute inset-x-0 top-0 bg-slate-50"
                  style={{ height: col.hours.opensMin - gridTop }}
                  aria-hidden
                />
              )}
              {col.hours && col.hours.closesMin - gridTop < gridHeight && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-slate-50"
                  style={{ height: gridHeight - (col.hours.closesMin - gridTop) }}
                  aria-hidden
                />
              )}

              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-slate-100"
                  style={{ top: (h - startHour) * HOUR_HEIGHT }}
                />
              ))}
              {positioned.map(({ appointment: a, column, columns: colCount }) => {
                const top = (minutesFromStart(a.start_time, startHour) / 60) * HOUR_HEIGHT
                const height = Math.max(
                  ((minutesFromStart(a.end_time, startHour) - minutesFromStart(a.start_time, startHour)) /
                    60) *
                    HOUR_HEIGHT,
                  18,
                )
                const widthPct = 100 / colCount
                return (
                  <Link
                    key={a.id}
                    to={`/${garageId}/appointments/${a.id}/overview`}
                    className={`absolute overflow-hidden rounded-md border border-black/10 px-1.5 py-0.5 text-[11px] leading-tight shadow-sm hover:z-10 hover:shadow-md ${statusBadgeClass(statusConfig, a.status)}`}
                    style={{
                      top,
                      height,
                      left: `${column * widthPct}%`,
                      width: `calc(${widthPct}% - 2px)`,
                    }}
                    title={`${formatTime(a.start_time)}–${formatTime(a.end_time)} · ${customerName(a.customer_id)}`}
                  >
                    <p className="truncate font-medium">
                      {formatTime(a.start_time)} {customerName(a.customer_id)}
                    </p>
                    <p className="truncate opacity-80">{appointmentTypeName(a.appointment_type_id)}</p>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
