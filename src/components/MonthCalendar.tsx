import { Link } from 'react-router-dom'
import type { Appointment } from '../types'
import { formatLongDate, formatTime, localDateKey } from '../lib/datetime'
import { useGarageId } from '../hooks/useGarageId'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE_APPOINTMENTS = 3

interface Props {
  dates: string[]
  month: string
  today: string
  appointments: Appointment[]
  customerName: (id: string) => string
  appointmentTypeName: (appointment: Appointment) => string
  onSelectDay: (date: string) => void
}

export function MonthCalendar({ dates, month, today, appointments, customerName, appointmentTypeName, onSelectDay }: Props) {
  const garageId = useGarageId()
  const appointmentsByDate = new Map<string, Appointment[]>()
  for (const appointment of appointments) {
    const date = localDateKey(appointment.start_time)
    const onDate = appointmentsByDate.get(date) ?? []
    onDate.push(appointment)
    appointmentsByDate.set(date, onDate)
  }
  for (const onDate of appointmentsByDate.values()) onDate.sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((day) => <div key={day} className="px-2 py-2 text-center text-xs font-medium text-slate-600">{day}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {dates.map((date) => {
            const isCurrentMonth = date.slice(0, 7) === month.slice(0, 7)
            const isToday = date === today
            const onDate = appointmentsByDate.get(date) ?? []
            const visible = onDate.slice(0, MAX_VISIBLE_APPOINTMENTS)
            const remaining = onDate.length - visible.length
            return (
              <div key={date} className={`min-h-36 border-b border-r border-slate-200 p-1.5 ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'}`}>
                <button type="button" onClick={() => onSelectDay(date)} className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 ${isToday ? 'bg-slate-900 text-white hover:bg-slate-800' : isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`} aria-label={`View ${formatLongDate(date)}`} aria-current={isToday ? 'date' : undefined}>
                  {Number(date.slice(8, 10))}
                </button>
                <div className="space-y-1">
                  {visible.map((appointment) => (
                    <Link key={appointment.id} to={`/${garageId}/appointments/${appointment.id}/overview`} className="block truncate rounded bg-slate-100 px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500" title={`${formatTime(appointment.start_time)} ${customerName(appointment.customer_id)} · ${appointmentTypeName(appointment)}`}>
                      <span className="font-medium">{formatTime(appointment.start_time)}</span> {customerName(appointment.customer_id)}
                    </Link>
                  ))}
                  {remaining > 0 && <button type="button" onClick={() => onSelectDay(date)} className="block w-full truncate px-1.5 py-0.5 text-left text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline focus:outline-none focus:ring-2 focus:ring-slate-500">+{remaining} more</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
