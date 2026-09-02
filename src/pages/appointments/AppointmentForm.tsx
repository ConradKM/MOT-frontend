import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  useAppointments,
  useAppointmentTypes,
  useCancelAppointment,
  useCreateAppointment,
  useCustomers,
  useEmployees,
  useUpdateAppointment,
  useVehicles,
} from '../../api/queries'
import { isoToLocalInputValue, localInputValueToIso } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { RichDropdown } from '../../components/rich/RichDropdown'
import { RichTextInput } from '../../components/rich/RichTextInput'
import { richFieldBoxClass, richFieldFocusClass } from '../../components/rich/richFieldStyles'
import { useGarageId } from '../../hooks/useGarageId'
import { APPOINTMENT_STATUSES, appointmentStatusLabels } from '../../lib/appointments'
import type { AppointmentStatus } from '../../types'

const priceFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GBP' })

export function AppointmentForm() {
  const garageId = useGarageId()
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
  const { data: employees } = useEmployees()
  const { data: appointmentTypes } = useAppointmentTypes('ACTIVE')
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment(appointmentId ?? '')
  const cancelMutation = useCancelAppointment()

  const [employeeId, setEmployeeId] = useState('')
  const [customerId, setCustomerId] = useState(searchParams.get('customer_id') ?? '')
  const [vehicleId, setVehicleId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [appointmentTypeId, setAppointmentTypeId] = useState('')
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
      setAppointmentTypeId(existing.appointment_type_id)
      setStatus(existing.status)
      setNotes(existing.notes ?? '')
    }
  }, [existing])

  // Default new appointments to the first available type, rather than leaving the picker empty.
  useEffect(() => {
    if (!isEdit && !appointmentTypeId && appointmentTypes && appointmentTypes.length > 0) {
      setAppointmentTypeId(appointmentTypes[0].id)
    }
  }, [isEdit, appointmentTypeId, appointmentTypes])

  const appointmentTypeOptions = (appointmentTypes ?? []).map((t) => ({
    value: t.id,
    title: t.name,
    description:
      [t.description, t.base_price !== null ? `from ${priceFormatter.format(Number(t.base_price))}` : null]
        .filter(Boolean)
        .join(' · ') || undefined,
  }))

  const submitting = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    setConflict(false)
    if (!appointmentTypeId) {
      setErrors({ appointment_type_id: 'Please choose an appointment type.' })
      return
    }
    const payload = {
      employee_id: employeeId,
      customer_id: customerId,
      vehicle_id: vehicleId || null,
      start_time: localInputValueToIso(startTime),
      end_time: localInputValueToIso(endTime),
      appointment_type_id: appointmentTypeId,
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
      navigate(`/${garageId}/appointments`)
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
      navigate(`/${garageId}/appointments`)
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
            Employee
          </label>
          <div className="mt-1">
            <RichDropdown
              id="employee_id"
              options={(employees ?? []).map((e) => ({
                value: e.id,
                title: e.email,
                description: e.roles.map((r) => r.name).join(', ') || undefined,
              }))}
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Select an employee…"
              searchable
            />
          </div>
          {errors.employee_id && <p className="mt-1 text-sm text-red-600">{errors.employee_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="customer_id">
            Customer
          </label>
          <div className="mt-1">
            <RichDropdown
              id="customer_id"
              options={(customers ?? []).map((c) => ({
                value: c.id,
                title: `${c.first_name} ${c.last_name}`,
              }))}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Select a customer…"
              searchable
            />
          </div>
          {errors.customer_id && <p className="mt-1 text-sm text-red-600">{errors.customer_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle_id">
            Vehicle <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <div className="mt-1">
            <RichDropdown
              id="vehicle_id"
              options={[
                { value: '', title: 'No vehicle' },
                ...(vehicles ?? [])
                  .filter((v) => !customerId || v.customer_id === customerId)
                  .map((v) => ({ value: v.id, title: v.registration_number })),
              ]}
              value={vehicleId}
              onChange={setVehicleId}
              placeholder="No vehicle"
              searchable
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="start_time">
              Start
            </label>
            <div className="mt-1">
              <RichTextInput
                id="start_time"
                type="datetime-local"
                required
                value={startTime}
                onChange={setStartTime}
              />
            </div>
            {errors.start_time && <p className="mt-1 text-sm text-red-600">{errors.start_time}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="end_time">
              End
            </label>
            <div className="mt-1">
              <RichTextInput
                id="end_time"
                type="datetime-local"
                required
                value={endTime}
                onChange={setEndTime}
              />
            </div>
            {errors.end_time && <p className="mt-1 text-sm text-red-600">{errors.end_time}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="appointment_type_id">
              Type
            </label>
            <div className="mt-1">
              <RichDropdown
                id="appointment_type_id"
                options={appointmentTypeOptions}
                value={appointmentTypeId}
                onChange={setAppointmentTypeId}
                placeholder={
                  appointmentTypes && appointmentTypes.length === 0
                    ? 'No appointment types set up yet'
                    : 'Select a type…'
                }
                disabled={!appointmentTypes || appointmentTypes.length === 0}
              />
            </div>
            {errors.appointment_type_id && (
              <p className="mt-1 text-sm text-red-600">{errors.appointment_type_id}</p>
            )}
          </div>
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <div className="mt-1">
                <RichDropdown
                  id="status"
                  options={APPOINTMENT_STATUSES.map((s) => ({ value: s, title: appointmentStatusLabels[s] }))}
                  value={status}
                  onChange={(value) => setStatus(value as AppointmentStatus)}
                />
              </div>
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
            className={`mt-1 ${richFieldBoxClass} ${richFieldFocusClass}`}
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
