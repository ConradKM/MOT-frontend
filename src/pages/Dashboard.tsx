import { Link, Navigate } from 'react-router-dom'
import { useAppointments, useCustomers, useGarage, useVehicles } from '../api/queries'
import { useGarageId } from '../hooks/useGarageId'
import { todayIso } from '../lib/datetime'

/** `/dashboard` — resolves the signed-in employee's own garage, then redirects to its
 * garage-scoped dashboard URL. Lets Login/Register and the nav link target a fixed path
 * without needing to know the garage id up front. */
export function DashboardRedirect() {
  const { data: garage } = useGarage()
  if (!garage) return null
  return <Navigate to={`/${garage.id}/dashboard`} replace />
}

export function Dashboard() {
  const garageId = useGarageId()
  const { data: garage } = useGarage()
  const { data: customers } = useCustomers()
  const { data: vehicles } = useVehicles()
  const { data: todaysAppointments } = useAppointments({ date: todayIso() })

  const expiringSoon = (vehicles ?? []).filter((v) => {
    if (!v.mot_expiry_date) return false
    const days = (new Date(v.mot_expiry_date).getTime() - Date.now()) / 86_400_000
    return days < 30
  })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Welcome{garage ? `, ${garage.name}` : ''}
      </h1>
      <p className="mt-1 text-sm text-slate-500">Here's what's going on today.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to={`/${garageId}/customers`}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-sm font-medium text-slate-500">Customers</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{customers?.length ?? '—'}</p>
        </Link>
        <Link
          to={`/${garageId}/vehicles`}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-sm font-medium text-slate-500">Vehicles</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{vehicles?.length ?? '—'}</p>
        </Link>
        <Link
          to={`/${garageId}/appointments`}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300"
        >
          <p className="text-sm font-medium text-slate-500">Today's appointments</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {todaysAppointments?.length ?? '—'}
          </p>
        </Link>
      </div>

      {expiringSoon.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">
            {expiringSoon.length} vehicle{expiringSoon.length === 1 ? '' : 's'} with an MOT
            expired or expiring within 30 days
          </p>
          <Link
            to={`/${garageId}/vehicles`}
            className="mt-2 inline-block text-sm font-medium text-amber-900 underline"
          >
            Review vehicles
          </Link>
        </div>
      )}
    </div>
  )
}
