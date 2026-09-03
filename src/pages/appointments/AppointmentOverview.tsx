import { Link, useParams } from 'react-router-dom'
import {
  useAppointments,
  useAppointmentStatuses,
  useAppointmentTypes,
  useCustomer,
  useEmployees,
  useUpdateAppointment,
  useVehicle,
} from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { useToast } from '../../components/Toast'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/datetime'
import { statusBadgeClass, statusLabel, statusOptions } from '../../lib/appointmentStatuses'
import { RichDropdown } from '../../components/rich/RichDropdown'
import type { AppointmentStatus } from '../../types'

export function AppointmentOverview() {
  const garageId = useGarageId()
  const { appointmentId } = useParams<{ appointmentId: string }>()
  // No GET /api/appointments/{id} exists; find it from the already-fetched unfiltered list.
  const { data: allAppointments, isLoading } = useAppointments()
  const appointment = allAppointments?.find((a) => a.id === appointmentId)

  const { data: customer } = useCustomer(appointment?.customer_id)
  const { data: vehicle } = useVehicle(appointment?.vehicle_id ?? undefined)
  const { data: employees } = useEmployees()
  const { data: appointmentTypes } = useAppointmentTypes()
  const { data: statusConfig } = useAppointmentStatuses()
  const updateMutation = useUpdateAppointment(appointmentId as string)
  const { showToast } = useToast()

  const employee = employees?.find((e) => e.id === appointment?.employee_id)
  const appointmentType = appointmentTypes?.find((t) => t.id === appointment?.appointment_type_id)

  const handleStatusChange = async (status: string) => {
    try {
      await updateMutation.mutateAsync({ status: status as AppointmentStatus })
      showToast('Status updated.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>
  if (!appointment) return <p className="text-sm text-red-600">Appointment not found.</p>

  return (
    <div className="max-w-2xl">
      <Link
        to={`/${garageId}/appointments`}
        className="text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← Back to appointments
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {appointmentType?.name ?? 'Appointment'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{formatDateTime(appointment.start_time)}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${statusBadgeClass(statusConfig, appointment.status)}`}
        >
          {statusLabel(statusConfig, appointment.status)}
        </span>
      </div>

      <div className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-medium uppercase text-slate-400">Customer</p>
          <p className="mt-0.5 text-sm text-slate-900">
            {customer ? `${customer.first_name} ${customer.last_name}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-slate-400">Vehicle</p>
          <p className="mt-0.5 text-sm text-slate-900">
            {vehicle ? vehicle.registration_number : 'No vehicle on this booking'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-slate-400">Assigned to</p>
          <p className="mt-0.5 text-sm text-slate-900">{employee ? employee.email : '—'}</p>
        </div>
        {appointment.notes && (
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">Notes</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-900">{appointment.notes}</p>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-700">Change status</p>
        <div className="mt-2 max-w-xs">
          <RichDropdown
            options={statusOptions(statusConfig).map((s) => ({ value: s.key, title: s.label }))}
            value={appointment.status}
            onChange={handleStatusChange}
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          to={`/${garageId}/appointments/${appointment.id}/checklist`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Go to checklist
        </Link>
        <Link
          to={`/${garageId}/appointments/${appointment.id}/edit`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit details
        </Link>
      </div>
    </div>
  )
}
