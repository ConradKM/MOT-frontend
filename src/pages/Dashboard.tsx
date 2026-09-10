import { Link, Navigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import {
  useAppointments,
  useAppointmentStatuses,
  useAppointmentTypes,
  useBookingRequests,
  useCapacitySummary,
  useCustomers,
  useGarage,
} from '../api/queries'
import type { CapacityLevel } from '../api/garageCapacity'
import { useGarageId } from '../hooks/useGarageId'
import { formatTimeRange, todayIso } from '../lib/datetime'
import { formatDurationMinutes } from '../lib/duration'
import { statusBadgeClass, statusLabel } from '../lib/appointmentStatuses'

/** `/dashboard` — resolves the signed-in employee's own garage, then redirects to its
 * garage-scoped dashboard URL. Lets Login/Register and the nav link target a fixed path
 * without needing to know the garage id up front. */
export function DashboardRedirect() {
  const { data: garage } = useGarage()
  if (!garage) return null
  return <Navigate to={`/${garage.id}/dashboard`} replace />
}

const LEVEL_STYLE: Record<CapacityLevel, { card: string; text: string; label: string }> = {
  green: { card: 'border-emerald-300 bg-emerald-50', text: 'text-emerald-900', label: 'Available' },
  amber: { card: 'border-amber-300 bg-amber-50', text: 'text-amber-900', label: 'Filling up' },
  red: { card: 'border-rose-300 bg-rose-50', text: 'text-rose-900', label: 'Full' },
}

function CapacityCard({
  title,
  bookedMinutes,
  capacityMinutes,
  level,
  to,
}: {
  title: string
  bookedMinutes?: number
  capacityMinutes?: number
  level?: CapacityLevel
  to: string
}) {
  const style = level ? LEVEL_STYLE[level] : null
  const known = bookedMinutes !== undefined && capacityMinutes !== undefined
  return (
    <Link
      to={to}
      className={`block cursor-pointer rounded-lg border p-5 shadow-sm transition hover:shadow-md hover:brightness-[0.98] ${
        style?.card ?? 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className={`mt-1 text-3xl font-semibold ${style?.text ?? 'text-slate-900'}`}>
        {known ? formatDurationMinutes(bookedMinutes) : '—'}{' '}
        <span className="text-xl font-normal text-slate-400">
          / {known ? formatDurationMinutes(capacityMinutes) : '—'}
        </span>
      </p>
      <p className={`mt-1 text-sm font-medium ${style?.text ?? 'text-slate-500'}`}>
        {style ? `${style.label} · View diary →` : 'View diary →'}
      </p>
    </Link>
  )
}

export function Dashboard() {
  const garageId = useGarageId()
  const { data: garage } = useGarage()
  const { data: customers } = useCustomers()
  const { data: capacity } = useCapacitySummary()
  const { data: todaysAppointments } = useAppointments({ date: todayIso() })
  const { data: appointmentTypes } = useAppointmentTypes()
  const { data: pendingRequests } = useBookingRequests('PENDING')
  const { data: statusConfig } = useAppointmentStatuses()

  const customerName = (id: string) => {
    const c = customers?.find((c) => c.id === id)
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown customer'
  }
  const appointmentTypeName = (id: string) => appointmentTypes?.find((t) => t.id === id)?.name ?? '—'

  const sortedAppointments = [...(todaysAppointments ?? [])].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  )

  return (
    <div>
      <div className="flex items-center gap-3">
        <img src={logo} alt="" className="h-10 w-auto shrink-0" />
        <h1 className="text-2xl font-semibold text-slate-900">
          {garage?.name ?? 'Welcome'}
        </h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">Here's what's going on today.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CapacityCard
          title="Today's booked time"
          bookedMinutes={capacity?.today.booked_minutes}
          capacityMinutes={capacity?.today.capacity_minutes}
          level={capacity?.today.level}
          to={`/${garageId}/appointments?view=day&date=${todayIso()}`}
        />
        <CapacityCard
          title="This week's booked time"
          bookedMinutes={capacity?.week.booked_minutes}
          capacityMinutes={capacity?.week.capacity_minutes}
          level={capacity?.week.level}
          to={`/${garageId}/appointments?view=week`}
        />
        <Link
          to={`/${garageId}/appointments`}
          className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-sm font-semibold text-slate-900">Edit appointments</p>
          <p className="mt-1 text-sm text-slate-500">View, add or modify appointments.</p>
          <p className="mt-auto pt-3 text-sm font-medium text-slate-900">Manage appointments →</p>
        </Link>
      </div>

      {(pendingRequests?.length ?? 0) > 0 && (
        <div className="mt-6 rounded-lg border border-violet-200 bg-violet-50 p-5">
          <p className="text-sm font-medium text-violet-800">
            {pendingRequests!.length} public booking request
            {pendingRequests!.length === 1 ? '' : 's'} waiting for review
          </p>
          <Link
            to={`/${garageId}/booking-requests`}
            className="mt-2 inline-block text-sm font-medium text-violet-900 underline"
          >
            Review requests
          </Link>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Today's appointments</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {sortedAppointments.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Nothing booked for today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedAppointments.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/${garageId}/appointments/${a.id}/overview`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {customerName(a.customer_id)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {formatTimeRange(a.start_time, a.end_time)} ·{' '}
                        {appointmentTypeName(a.appointment_type_id)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(statusConfig, a.status)}`}
                    >
                      {statusLabel(statusConfig, a.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
