import { Link, useParams } from 'react-router-dom'
import { useCustomerAppointment } from '../../api/queries'
import { appointmentStatusClasses, appointmentStatusLabels } from '../../lib/appointments'
import { formatDateTime } from '../../lib/datetime'
import { errorMessage, isApiError } from '../../lib/errors'

export function CustomerAppointmentDetail() {
  const { appointmentId } = useParams<{ appointmentId: string }>()
  const { data: appointment, isLoading, isError, error } = useCustomerAppointment(appointmentId)

  const backLink = (
    <Link
      to="/customer/account"
      className="text-sm font-medium text-slate-500 hover:text-slate-800"
    >
      ← Back to my account
    </Link>
  )

  if (isLoading) {
    return (
      <div>
        {backLink}
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      </div>
    )
  }

  if (isError || !appointment) {
    const notFound = isApiError(error) && error.code === 404
    return (
      <div>
        {backLink}
        <p className="mt-4 text-sm text-red-600">
          {notFound ? 'Appointment not found.' : errorMessage(error)}
        </p>
      </div>
    )
  }

  const vehicleDescription = appointment.vehicle
    ? [
        appointment.vehicle.registration_number,
        [appointment.vehicle.make, appointment.vehicle.model, appointment.vehicle.year]
          .filter(Boolean)
          .join(' '),
      ]
        .filter(Boolean)
        .join(' — ')
    : 'No vehicle on this booking'

  return (
    <div className="max-w-2xl">
      {backLink}

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {appointment.appointment_type_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(appointment.start_time)} – {formatDateTime(appointment.end_time)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${appointmentStatusClasses[appointment.status]}`}
        >
          {appointmentStatusLabels[appointment.status]}
        </span>
      </div>

      <div className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        {appointment.appointment_type_description && (
          <Row label="What's included">{appointment.appointment_type_description}</Row>
        )}
        <Row label="Vehicle">{vehicleDescription}</Row>
        <Row label="Business">{appointment.garage_name}</Row>
        {appointment.notes && (
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Notes</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">
              {appointment.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{children}</p>
    </div>
  )
}
