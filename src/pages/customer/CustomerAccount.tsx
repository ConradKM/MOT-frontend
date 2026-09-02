import { Link, useNavigate } from 'react-router-dom'
import type { CustomerAppointmentSummary, CustomerVehicle } from '../../api/customerAccount'
import { useCustomerAccount } from '../../api/queries'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
import { MotBadge } from '../../components/MotBadge'
import { appointmentStatusClasses, appointmentStatusLabels } from '../../lib/appointments'
import { formatDateTime } from '../../lib/datetime'
import { errorMessage } from '../../lib/errors'

export function CustomerAccount() {
  const { logout } = useCustomerAuth()
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useCustomerAccount()

  const signOut = () => {
    logout()
    navigate('/customer/login', { replace: true })
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading your account…</p>
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5">
        <p className="text-sm text-red-700">{errorMessage(error)}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 text-sm font-medium text-red-800 underline"
        >
          Sign in again
        </button>
      </div>
    )
  }

  const { customer, vehicles, appointments } = data
  const now = Date.now()
  const upcoming = appointments.filter((a) => new Date(a.start_time).getTime() >= now)
  const past = appointments
    .filter((a) => new Date(a.start_time).getTime() < now)
    .reverse()

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Hi {customer.first_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{customer.garage_name}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Your vehicles</h2>
        {vehicles.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No vehicles on file.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Upcoming appointments</h2>
        <AppointmentList
          appointments={upcoming}
          emptyText="Nothing booked in."
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Past appointments</h2>
        <AppointmentList appointments={past} emptyText="No past appointments." />
      </section>
    </div>
  )
}

function VehicleCard({ vehicle }: { vehicle: CustomerVehicle }) {
  const latestMot = vehicle.mot_records[0]
  const description = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{vehicle.registration_number}</p>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        <MotBadge motExpiryDate={vehicle.mot_expiry_date} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">MOT expires</dt>
        <dd className="text-right text-slate-800">{vehicle.mot_expiry_date ?? 'Unknown'}</dd>
        {latestMot && (
          <>
            <dt className="text-slate-500">Last test</dt>
            <dd className="text-right text-slate-800">
              {latestMot.result} · {latestMot.mot_date}
            </dd>
          </>
        )}
        {vehicle.current_mileage != null && (
          <>
            <dt className="text-slate-500">Mileage on file</dt>
            <dd className="text-right text-slate-800">
              {vehicle.current_mileage.toLocaleString()}
            </dd>
          </>
        )}
      </dl>
    </div>
  )
}

function AppointmentList({
  appointments,
  emptyText,
}: {
  appointments: CustomerAppointmentSummary[]
  emptyText: string
}) {
  if (appointments.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
  }

  return (
    <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {appointments.map((a) => (
        <li key={a.id}>
          <Link
            to={`/customer/appointments/${a.id}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {a.appointment_type_name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {formatDateTime(a.start_time)}
                {a.vehicle_registration ? ` · ${a.vehicle_registration}` : ''}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${appointmentStatusClasses[a.status]}`}
            >
              {appointmentStatusLabels[a.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
