import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CustomerAppointmentSummary, CustomerVehicle } from '../../api/customerAccount'
import {
  useCustomerAccount,
  useCustomerAppointment,
  useSetCustomerPassword,
} from '../../api/queries'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
import { MotBadge } from '../../components/MotBadge'
import { appointmentStatusClasses, appointmentStatusLabels } from '../../lib/appointments'
import { formatDateShort, formatDateTime } from '../../lib/datetime'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { AppointmentDetailBody } from './CustomerAppointmentDetail'

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
        <h2 className="text-lg font-semibold text-slate-900">Your details</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <dt className="text-slate-500">Name</dt>
          <dd className="text-right text-slate-800">
            {customer.first_name} {customer.last_name}
          </dd>
          <dt className="text-slate-500">Email</dt>
          <dd className="text-right text-slate-800">{customer.email ?? '—'}</dd>
          <dt className="text-slate-500">Phone</dt>
          <dd className="text-right text-slate-800">{customer.phone ?? '—'}</dd>
        </dl>
        {!customer.has_password && <CreateAccountForm />}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Your vehicles</h2>
        {vehicles.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No vehicles on file.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {vehicles.map((v) => (
              <VehicleRow key={v.id} vehicle={v} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Upcoming appointments</h2>
        <AppointmentList appointments={upcoming} emptyText="Nothing booked in." />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Past appointments</h2>
        <AppointmentList appointments={past} emptyText="No past appointments." />
      </section>
    </div>
  )
}

/** Offered to a customer who signed in with a booking reference and hasn't
 * set a password yet - lets them start using email + password instead. */
function CreateAccountForm() {
  const setPassword = useSetCustomerPassword()
  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    if (password !== confirm) {
      setErrors({ confirm: 'Passwords do not match.' })
      return
    }
    try {
      await setPassword.mutateAsync(password)
      setDone(true)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    }
  }

  if (done) {
    return (
      <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        Password set — you can now sign in with your email and password.
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-slate-900">Create an account</h3>
      <p className="mt-1 text-xs text-slate-500">
        Set a password so you can sign in with your email next time, instead of a booking
        reference.
      </p>
      {formError && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="new-password">
            Password
          </label>
          <input
            id="new-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="confirm-password">
            Confirm
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.confirm && <p className="mt-1 text-sm text-red-600">{errors.confirm}</p>}
        </div>
      </div>
      <button
        type="submit"
        disabled={setPassword.isPending}
        className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {setPassword.isPending ? 'Saving…' : 'Set password'}
      </button>
    </form>
  )
}

function VehicleRow({ vehicle }: { vehicle: CustomerVehicle }) {
  const latestMot = vehicle.mot_records[0]
  const description = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')

  return (
    <details className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {vehicle.registration_number}
          </p>
          {description && <p className="truncate text-xs text-slate-500">{description}</p>}
        </div>
        <MotBadge motExpiryDate={vehicle.mot_expiry_date} />
      </summary>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-3 text-sm">
        <dt className="text-slate-500">MOT expires</dt>
        <dd className="text-right text-slate-800">
          {vehicle.mot_expiry_date ? formatDateShort(vehicle.mot_expiry_date) : 'Unknown'}
        </dd>
        {latestMot && (
          <>
            <dt className="text-slate-500">Last test</dt>
            <dd className="text-right text-slate-800">
              {latestMot.result} · {formatDateShort(latestMot.mot_date)}
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
    </details>
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
    <div className="mt-3 space-y-2">
      {appointments.map((a) => (
        <AppointmentRow key={a.id} appointment={a} />
      ))}
    </div>
  )
}

/** Collapsed by default; expanding fetches the full detail on demand (the
 * same endpoint the standalone appointment page uses) rather than the
 * account payload carrying every appointment's full detail up front. */
function AppointmentRow({ appointment }: { appointment: CustomerAppointmentSummary }) {
  const [expanded, setExpanded] = useState(false)
  const {
    data: detail,
    isLoading,
    isError,
  } = useCustomerAppointment(expanded ? appointment.id : undefined)

  return (
    <details
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {appointment.appointment_type_name}
          </p>
          <p className="truncate text-xs text-slate-500">
            {formatDateTime(appointment.start_time)}
            {appointment.vehicle_registration ? ` · ${appointment.vehicle_registration}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${appointmentStatusClasses[appointment.status]}`}
        >
          {appointmentStatusLabels[appointment.status]}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-4 py-3">
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {isError && <p className="text-sm text-red-600">Couldn't load this appointment.</p>}
        {detail && <AppointmentDetailBody appointment={detail} />}
      </div>
    </details>
  )
}
