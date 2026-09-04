import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  useAppointments,
  useAppointmentStatuses,
  useAppointmentTypes,
  useCancelAppointment,
  useCustomers,
  useEmployees,
  useGarageSchedule,
  useVehicles,
} from '../../api/queries'
import {
  addDaysIso,
  formatDateShort,
  formatShortDate,
  formatTimeRange,
  localDateKey,
  todayIso,
  weekDatesIso,
} from '../../lib/datetime'
import { resolveDayHours } from '../../lib/calendarLayout'
import { statusBadgeClass, statusLabel } from '../../lib/appointmentStatuses'
import { employeeDisplayName, employeeNameById } from '../../lib/employees'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { RichDropdown } from '../../components/rich/RichDropdown'
import { TimeGridCalendar, type CalendarColumn } from '../../components/TimeGridCalendar'
import { useGarageId } from '../../hooks/useGarageId'
import type { Appointment } from '../../types'

type Mode = 'day' | 'week' | 'list'

const MODES: Mode[] = ['day', 'week', 'list']

export function AppointmentsCalendar() {
  const garageId = useGarageId()
  // Dashboard shortcut cards link here with e.g. ?view=week to open a view.
  const [searchParams] = useSearchParams()
  const initialMode = MODES.includes(searchParams.get('view') as Mode)
    ? (searchParams.get('view') as Mode)
    : 'day'
  const initialDate = searchParams.get('date') || todayIso()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [date, setDate] = useState(initialDate)
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
  const { data: employees } = useEmployees()
  const { data: appointmentTypes } = useAppointmentTypes()
  const { data: statusConfig } = useAppointmentStatuses()
  const { data: schedule } = useGarageSchedule()
  const cancelMutation = useCancelAppointment()

  const activeEmployees = useMemo(
    () => (employees ?? []).filter((e) => e.is_active),
    [employees],
  )

  const employeeFilterOptions = useMemo(
    () => [
      { value: '', title: 'All employees' },
      ...activeEmployees.map((e) => ({ value: e.id, title: employeeDisplayName(e) })),
    ],
    [activeEmployees],
  )

  const customerName = (id: string) => {
    const c = customers?.find((c) => c.id === id)
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown customer'
  }
  const vehicleReg = (id: string | null) => {
    if (id === null) return null
    return vehicles?.find((v) => v.id === id)?.registration_number ?? null
  }
  const appointmentTypeName = (id: string) => {
    return appointmentTypes?.find((t) => t.id === id)?.name ?? 'Unknown type'
  }

  // Day view: one column per active employee (or just the filtered one), so
  // the working-day grid always shows - even with zero appointments - rather
  // than depending on appointments existing to know which columns to draw.
  const dayColumns: CalendarColumn[] = useMemo(() => {
    const list = appointments ?? []
    const dayHours = resolveDayHours(schedule, date)
    const shown = employeeId
      ? activeEmployees.filter((e) => e.id === employeeId)
      : activeEmployees
    return shown.map((e) => ({
      key: e.id,
      label: employeeDisplayName(e),
      appointments: list.filter((a) => a.employee_id === e.id),
      hours: dayHours,
    }))
  }, [appointments, activeEmployees, employeeId, schedule, date])

  const weekColumns: CalendarColumn[] = useMemo(() => {
    const list = appointments ?? []
    return weekDates.map((d) => ({
      key: d,
      label: formatShortDate(d),
      appointments: list.filter((a) => localDateKey(a.start_time) === d),
      hours: resolveDayHours(schedule, d),
    }))
  }, [appointments, weekDates, schedule])

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
    return [...byEmployee.entries()].sort(([a], [b]) =>
      employeeNameById(employees, a).localeCompare(employeeNameById(employees, b)),
    )
  }, [appointments, employees])

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

        <div className="w-64">
          <RichDropdown
            options={employeeFilterOptions}
            value={employeeId}
            onChange={setEmployeeId}
            placeholder="All employees"
            searchable
            searchPlaceholder="Search employees…"
          />
        </div>
      </div>

      <div className="mt-6">
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {isError && <p className="text-sm text-red-600">Failed to load appointments.</p>}

        {!isLoading && !isError && mode === 'day' && (
          <>
            {dayColumns.length === 0 ? (
              <p className="text-sm text-slate-500">
                No employees to show a calendar for yet - add one under Settings → Employees.
              </p>
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
                  {employeeNameById(employees, empId)}
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Date</th>
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
                        <td className="px-4 py-2 text-slate-500">
                          {formatDateShort(a.start_time)}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
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
