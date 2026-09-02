import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Appointment } from '../types'
import { hourRangeForAppointments, layoutOverlaps } from '../lib/calendarLayout'
import { appointmentStatusClasses } from '../lib/appointments'
import { formatTime } from '../lib/datetime'
import { useGarageId } from '../hooks/useGarageId'

export interface CalendarColumn {
  key: string
  label: ReactNode
  appointments: Appointment[]
}

interface Props {
  columns: CalendarColumn[]
  customerName: (id: string) => string
  appointmentTypeName: (id: string) => string
}

const HOUR_HEIGHT = 56

function minutesFromStart(iso: string, startHour: number): number {
  const d = new Date(iso)
  return (d.getHours() - startHour) * 60 + d.getMinutes()
}

export function TimeGridCalendar({ columns, customerName, appointmentTypeName }: Props) {
  const garageId = useGarageId()
  const allAppointments = columns.flatMap((c) => c.appointments)
  const [startHour, endHour] = hourRangeForAppointments(allAppointments)
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const gridHeight = (endHour - startHour) * HOUR_HEIGHT

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div
        className="grid"
        style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(160px, 1fr))` }}
      >
        <div className="border-b border-r border-slate-200" />
        {columns.map((col) => (
          <div
            key={col.key}
            className="border-b border-r border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-600 last:border-r-0"
          >
            {col.label}
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
                    className={`absolute overflow-hidden rounded-md border border-black/10 px-1.5 py-0.5 text-[11px] leading-tight shadow-sm hover:z-10 hover:shadow-md ${appointmentStatusClasses[a.status]}`}
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
