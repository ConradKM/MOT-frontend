import { useMemo, useState } from 'react'
import { useGarageSchedule } from '../../api/queries'
import { resolveDayHours } from '../../lib/calendarLayout'
import {
  addDaysIso,
  formatShortDate,
  localDateKey,
  weekDatesIso,
} from '../../lib/datetime'
import type { Appointment, AppointmentNormalised, ImportItem } from '../../types'
import { TimeGridCalendar, type CalendarColumn } from '../TimeGridCalendar'
import { AppointmentCard } from './AppointmentCard'
import { Button } from './controls'

/**
 * An import preview on the app's own week/day grid (`TimeGridCalendar`), in
 * its read-only mode: blocks are buttons that show a row's details, not links
 * to an appointment that does not exist yet.
 *
 * Preview rows are adapted into the grid's `Appointment` shape. Only the
 * fields the grid reads are meaningful; the id is the row index.
 */

const ROW_ID_PREFIX = 'import-row-'

function asAppointment(item: ImportItem): Appointment | null {
  const a = item.normalised as AppointmentNormalised
  if (!a.start) return null
  const end = a.end ?? new Date(new Date(a.start).getTime() + 30 * 60_000).toISOString()
  return {
    id: `${ROW_ID_PREFIX}${item.index}`,
    garage_id: '',
    employee_id: '',
    customer_id: String(item.index),
    vehicle_id: null,
    start_time: a.start,
    end_time: end,
    appointment_type_id: '',
    status: a.status ?? 'BOOKED',
    notes: a.notes ?? null,
    price_at_booking: a.price_at_booking ?? null,
    appointment_type_name_at_booking: a.service ?? 'Unmatched service',
    created_at: '',
    updated_at: '',
  }
}

function tone(item: ImportItem) {
  if (item.status === 'ERROR')
    return { className: 'bg-red-50 text-red-900 border-l-4 border-l-red-500!', icon: '✕', label: 'Error' }
  if (item.warnings.length > 0)
    return {
      className: 'bg-amber-50 text-amber-950 border-l-4 border-l-amber-500!',
      icon: '⚠',
      label: 'Warning',
    }
  if (item.status === 'EXISTS')
    return { className: 'bg-slate-100 text-slate-700', icon: '=', label: 'Already exists' }
  return { className: 'bg-emerald-50 text-emerald-950', icon: '+', label: 'New' }
}

export function ImportCalendar({ items }: { items: ImportItem[] }) {
  const { data: schedule } = useGarageSchedule()
  const byIndex = useMemo(() => new Map(items.map((item) => [item.index, item])), [items])
  const timed = useMemo(
    () =>
      items.flatMap((item) => {
        const appointment = asAppointment(item)
        return appointment ? [appointment] : []
      }),
    [items],
  )
  const days = useMemo(
    () => [...new Set(timed.map((a) => localDateKey(a.start_time)))].sort(),
    [timed],
  )

  const [view, setView] = useState<'week' | 'day'>('week')
  const [anchor, setAnchor] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const current = anchor ?? days[0] ?? null

  if (current === null) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
        None of these rows has a readable time to show on a calendar.
      </p>
    )
  }

  const dates = view === 'week' ? weekDatesIso(current) : [current]
  const columns: CalendarColumn[] = dates.map((d) => ({
    key: d,
    label: formatShortDate(d),
    appointments: timed.filter((a) => localDateKey(a.start_time) === d),
    hours: resolveDayHours(schedule, d),
  }))
  const itemOf = (a: Appointment) => byIndex.get(Number(a.customer_id))
  const untimed = items.length - timed.length
  const selectedItem = selected === null ? null : (byIndex.get(selected) ?? null)
  const step = view === 'week' ? 7 : 1

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="min-h-11" onClick={() => setAnchor(addDaysIso(current, -step))}>
          <span aria-hidden>←</span> <span className="sr-only">Previous {view}</span>
        </Button>
        <p role="status" className="min-w-40 text-sm font-medium text-slate-800">
          {view === 'week' ? `Week of ${formatShortDate(dates[0])}` : formatShortDate(current)}
        </p>
        <Button type="button" className="min-h-11" onClick={() => setAnchor(addDaysIso(current, step))}>
          <span aria-hidden>→</span> <span className="sr-only">Next {view}</span>
        </Button>
        <label className="flex items-center text-sm text-slate-700">
          <span className="sr-only">Jump to a day with bookings</span>
          <select
            className="min-h-11 rounded-md border border-slate-300 px-2 text-sm"
            value={days.includes(current) ? current : ''}
            onChange={(event) => event.target.value && setAnchor(event.target.value)}
          >
            <option value="">Jump to…</option>
            {days.map((day) => (
              <option key={day} value={day}>
                {formatShortDate(day)}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto inline-flex rounded-md border border-slate-300 p-0.5" role="group" aria-label="Calendar range">
          {(['day', 'week'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`min-h-11 rounded px-3 text-sm font-medium ${
                view === key ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {key === 'day' ? 'Day' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      <TimeGridCalendar
        columns={columns}
        customerName={(index) => {
          const customer = (byIndex.get(Number(index))?.normalised as AppointmentNormalised)?.customer
          return customer ? `${customer.first_name} ${customer.last_name}` : 'No customer'
        }}
        appointmentTypeName={(a) => a.appointment_type_name_at_booking ?? ''}
        onSelect={(a) => setSelected(Number(a.customer_id))}
        selectedId={selected === null ? null : `${ROW_ID_PREFIX}${selected}`}
        blockClassName={(a) => {
          const item = itemOf(a)
          return item ? tone(item).className : ''
        }}
        marker={(a) => {
          const item = itemOf(a)
          if (!item) return null
          const { icon, label } = tone(item)
          return { icon, label }
        }}
      />

      {untimed > 0 ? (
        <p className="text-xs text-slate-600">
          {untimed} row{untimed === 1 ? ' has' : 's have'} no readable time and{' '}
          {untimed === 1 ? 'is' : 'are'} only in the list view.
        </p>
      ) : null}

      {selectedItem ? (
        <section aria-label="Selected appointment" className="rounded-lg border border-slate-300 p-3">
          <AppointmentCard item={selectedItem} />
          <Button type="button" variant="ghost" className="mt-2 min-h-11" onClick={() => setSelected(null)}>
            Close
          </Button>
        </section>
      ) : null}
    </div>
  )
}
