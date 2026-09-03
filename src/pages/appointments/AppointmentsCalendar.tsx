import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAppointments,
  useAppointmentStatuses,
  useAppointmentTypes,
  useCancelAppointment,
  useCustomers,
  useVehicles,
} from '../../api/queries'
import {
  addDaysIso,
  formatTimeRange,
  localDateKey,
  todayIso,
  weekDatesIso,
} from '../../lib/datetime'
import { statusBadgeClass, statusLabel } from '../../lib/appointmentStatuses'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { TimeGridCalendar, type CalendarColumn } from '../../components/TimeGridCalendar'
import { useGarageId } from '../../hooks/useGarageId'
import type { Appointment } from '../../types'

type Mode = 'day' | 'week' | 'list'

export function AppointmentsCalendar() {
  const garageId = useGarageId()
  const [mode, setMode] = useState<Mode>('day')
  const [date, setDate] = useState(todayIso())
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(todayIso())
  const [employeeId, setEmployeeId] = useState('')
  const { showToast } = useToast()

  const weekDates = useMemo(() => weekDatesIso(date), [date])

  const listParams =
    mode === 'day'
      ? { date, employee_id: employeeId || undefined }
      : mode === 'week'
        ? {
            start_date: weekDates[0],
            end_date: weekDates[6],
            employee_id: employeeId || undefined,
          }
        : {
            start_date: startDate,
            end_date: endDate,
            employee_id: employeeId || undefined,
          }

  const { data: appointments, isLoading, isError } = useAppointments(listParams)
  const { data: customers } = useCustomers()
  const { data: vehicles } = useVehicles()
  const { data: appointmentTypes } = useAppointmentTypes()
  const { data: statusConfig } = useAppointmentStatuses()
  const cancelMutation = useCancelAppointment()

  const customerName = (id: string) => {
    const c = customers?.find((c) => c.id === id)
    return c ? `${c.first_name} ${c.last_name}` : `Customer #${id}`
  }
  const vehicleReg = (id: string | null) => {
    if (id === null) return null
    return vehicles?.find((v) => v.id === id)?.registration_number ?? `Vehicle #${id}`
  }
  const appointmentTypeName = (id: string) => {
    return appointmentTypes?.find((t) => t.id === id)?.name ?? 'Unknown type'
  }

  const dayColumns: CalendarColumn[] = useMemo(() => {
    const list = appointments ?? []
    const employeeIds = employeeId
      ? [employeeId]
      : [...new Set(list.map((a) => a.employee_id))].sort()
    return employeeIds.map((id) => ({
      key: id,
      label: `Employee #${id}`,
      appointments: list.filter((a) => a.employee_id === id),
    }))
  }, [appointments, employeeId])

  const weekColumns: CalendarColumn[] = useMemo(() => {
    const list = appointments ?? []
    return weekDates.map((d) => ({
      key: d,
      label: new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      appointments: list.filter((a) => localDateKey(a.start_time) === d),
    }))
  }, [appointments, weekDates])

  const grouped = useMemo(() => {
    const byEmployee = new Map<string, Appointment[]>()
    for (const a of appointments ?? []) {
      const list = byEmployee.get(a.employee_id) ?? []
      list.push(a)
      byEmployee.set(a.employee_id, list)
    }
    for (const list of byEmployee.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time))
    }
    return [...byEmployee.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [appointments])

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this appointment?')) return
    try {
      await cancelMutation.mutateAsync(id)
      showToast('Appointment cancelled.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Appointments</h1>
        <Link
          to={`/${garageId}/appointments/new`}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New appointment
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-slate-300 text-sm">
          <button
            onClick={() => setMode('day')}
            className={`px-3 py-1.5 ${mode === 'day' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
          >
            Day
          </button>
          <button
            onClick={() => setMode('week')}
            className={`px-3 py-1.5 ${mode === 'week' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
          >
            Week
          </button>
          <button
            onClick={() => setMode('list')}
            className={`px-3 py-1.5 ${mode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
          >
            List
          </button>
        </div>

        {mode !== 'list' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDate((d) => addDaysIso(d, mode === 'week' ? -7 : -1))}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              ← Prev
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
            <button
              onClick={() => setDate((d) => addDaysIso(d, mode === 'week' ? 7 : 1))}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Next →
            </button>
            <button
              onClick={() => setDate(todayIso())}
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Today
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
            <span className="text-sm text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        )}

        <input
          type="text"
          placeholder="Filter by employee ID…"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="mt-6">
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {isError && <p className="text-sm text-red-600">Failed to load appointments.</p>}

        {!isLoading && !isError && mode === 'day' && (
          <>
            {dayColumns.length === 0 ? (
              <p className="text-sm text-slate-500">No appointments today.</p>
            ) : (
              <TimeGridCalendar
                columns={dayColumns}
                customerName={customerName}
                appointmentTypeName={appointmentTypeName}
              />
            )}
          </>
        )}

        {!isLoading && !isError && mode === 'week' && (
          <TimeGridCalendar
            columns={weekColumns}
            customerName={customerName}
            appointmentTypeName={appointmentTypeName}
          />
        )}

        {!isLoading && !isError && mode === 'list' && (
          <div className="space-y-6">
            {grouped.length === 0 && <p className="text-sm text-slate-500">No appointments in this range.</p>}
            {grouped.map(([empId, list]) => (
              <div key={empId} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  Employee #{empId}
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Customer</th>
                      <th className="px-4 py-2 font-medium">Vehicle</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 text-slate-600">
                          <span className="mr-1 text-slate-400">{a.start_time.slice(0, 10)}</span>
                          {formatTimeRange(a.start_time, a.end_time)}
                        </td>
                        <td className="px-4 py-2 text-slate-600">{customerName(a.customer_id)}</td>
                        <td className="px-4 py-2 text-slate-600">{vehicleReg(a.vehicle_id) ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {appointmentTypeName(a.appointment_type_id)}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(statusConfig, a.status)}`}
                          >
                            {statusLabel(statusConfig, a.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            to={`/${garageId}/appointments/${a.id}/overview`}
                            className="mr-3 font-medium text-slate-900 hover:underline"
                          >
                            Overview
                          </Link>
                          <Link
                            to={`/${garageId}/appointments/${a.id}/checklist`}
                            className="mr-3 font-medium text-slate-900 hover:underline"
                          >
                            Checklist
                          </Link>
                          <Link
                            to={`/${garageId}/appointments/${a.id}/edit`}
                            className="mr-3 font-medium text-slate-600 hover:underline"
                          >
                            Edit
                          </Link>
                          {a.status === 'BOOKED' && (
                            <button
                              onClick={() => handleCancel(a.id)}
                              className="font-medium text-red-700 hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
