import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  useAppointments,
  useCancelAppointment,
  useCreateAppointment,
  useCustomers,
  useUpdateAppointment,
  useVehicles,
} from '../../api/queries'
import { isoToLocalInputValue, localInputValueToIso } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import type { AppointmentStatus, AppointmentType } from '../../types'

const APPOINTMENT_TYPES: AppointmentType[] = ['MOT', 'SERVICE', 'MOT_AND_SERVICE', 'REPAIR', 'OTHER']
const APPOINTMENT_STATUSES: AppointmentStatus[] = ['BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']

export function AppointmentForm() {
  const { id: appointmentId } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = appointmentId !== undefined
  const navigate = useNavigate()
  const { showToast } = useToast()

  // No GET /api/appointments/{id} exists; find it from the already-fetched unfiltered list.
  const { data: allAppointments } = useAppointments()
  const existing = isEdit ? allAppointments?.find((a) => a.id === appointmentId) : undefined

  const { data: customers } = useCustomers()
  const { data: vehicles } = useVehicles()
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment(appointmentId ?? '')
  const cancelMutation = useCancelAppointment()

  const [employeeId, setEmployeeId] = useState('')
  const [customerId, setCustomerId] = useState(searchParams.get('customer_id') ?? '')
  const [vehicleId, setVehicleId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('MOT')
  const [status, setStatus] = useState<AppointmentStatus>('BOOKED')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    if (existing) {
      setEmployeeId(String(existing.employee_id))
      setCustomerId(String(existing.customer_id))
      setVehicleId(existing.vehicle_id !== null ? String(existing.vehicle_id) : '')
      setStartTime(isoToLocalInputValue(existing.start_time))
      setEndTime(isoToLocalInputValue(existing.end_time))
      setAppointmentType(existing.appointment_type)
      setStatus(existing.status)
      setNotes(existing.notes ?? '')
    }
  }, [existing])

  const submitting = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    setConflict(false)
    const payload = {
      employee_id: employeeId,
      customer_id: customerId,
      vehicle_id: vehicleId || null,
      start_time: localInputValueToIso(startTime),
      end_time: localInputValueToIso(endTime),
      appointment_type: appointmentType,
      status,
      notes: notes || null,
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload)
      } else {
        await createMutation.mutateAsync(payload)
        showToast('Appointment booked.', 'success')
      }
      navigate('/appointments')
    } catch (err) {
      if (isApiError(err) && err.code === 409) {
        setConflict(true)
        setFormError(errorMessage(err))
        return
      }
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    }
  }

  const handleCancelAppointment = async () => {
    if (!appointmentId) return
    if (!confirm('Cancel this appointment?')) return
    try {
      await cancelMutation.mutateAsync(appointmentId)
      showToast('Appointment cancelled.', 'success')
      navigate('/appointments')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          {isEdit ? 'Edit appointment' : 'New appointment'}
        </h1>
        {isEdit && existing?.status === 'BOOKED' && (
          <button
            type="button"
            onClick={handleCancelAppointment}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Cancel appointment
          </button>
        )}
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              conflict ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'
            }`}
          >
            {formError}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="employee_id">
            Employee ID
          </label>
          <input
            id="employee_id"
            type="text"
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">
            There's no picker here yet, so paste the employee's id directly. The backend now
            exposes GET /api/employees/ to look one up - this screen just doesn't call it yet.
          </p>
          {errors.employee_id && <p className="mt-1 text-sm text-red-600">{errors.employee_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="customer_id">
            Customer
          </label>
          <select
            id="customer_id"
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="" disabled>
              Select a customer
            </option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
          {errors.customer_id && <p className="mt-1 text-sm text-red-600">{errors.customer_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle_id">
            Vehicle <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <select
            id="vehicle_id"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">No vehicle</option>
            {vehicles
              ?.filter((v) => !customerId || v.customer_id === customerId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration_number}
                </option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="start_time">
              Start
            </label>
            <input
              id="start_time"
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {errors.start_time && <p className="mt-1 text-sm text-red-600">{errors.start_time}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="end_time">
              End
            </label>
            <input
              id="end_time"
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {errors.end_time && <p className="mt-1 text-sm text-red-600">{errors.end_time}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="appointment_type">
              Type
            </label>
            <select
              id="appointment_type"
              value={appointmentType}
              onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
                {APPOINTMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
