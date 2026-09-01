import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCreateVehicle, useCustomers, useUpdateVehicle, useVehicle } from '../../api/queries'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { useGarageId } from '../../hooks/useGarageId'

export function VehicleForm() {
  const garageId = useGarageId()
  const { id: vehicleId } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = vehicleId !== undefined
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { data: existing } = useVehicle(vehicleId)
  const { data: customers } = useCustomers()
  const createMutation = useCreateVehicle()
  const updateMutation = useUpdateVehicle(vehicleId ?? '')

  const [customerId, setCustomerId] = useState(searchParams.get('customer_id') ?? '')
  const [registration, setRegistration] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [mileage, setMileage] = useState('')
  const [motExpiryDate, setMotExpiryDate] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (existing) {
      setCustomerId(String(existing.customer_id))
      setRegistration(existing.registration_number)
      setMake(existing.make ?? '')
      setModel(existing.model ?? '')
      setYear(existing.year !== null ? String(existing.year) : '')
      setMileage(existing.current_mileage !== null ? String(existing.current_mileage) : '')
      setMotExpiryDate(existing.mot_expiry_date ?? '')
    }
  }, [existing])

  const submitting = createMutation.isPending || updateMutation.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    const payload = {
      customer_id: customerId,
      registration_number: registration,
      make: make || null,
      model: model || null,
      year: year ? Number(year) : null,
      current_mileage: mileage ? Number(mileage) : null,
      mot_expiry_date: motExpiryDate || null,
    }
    try {
      if (isEdit) {
        const updated = await updateMutation.mutateAsync(payload)
        navigate(`/${garageId}/vehicles/${updated.id}`)
      } else {
        const created = await createMutation.mutateAsync(payload)
        showToast('Vehicle created.', 'success')
        navigate(`/${garageId}/vehicles/${created.id}`)
      }
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-900">
        {isEdit ? 'Edit vehicle' : 'New vehicle'}
      </h1>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

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
          <label className="block text-sm font-medium text-slate-700" htmlFor="registration_number">
            Registration number
          </label>
          <input
            id="registration_number"
            required
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-slate-500 focus:outline-none"
          />
          {errors.registration_number && (
            <p className="mt-1 text-sm text-red-600">{errors.registration_number}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="make">
              Make
            </label>
            <input
              id="make"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="model">
              Model
            </label>
            <input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="year">
              Year
            </label>
            <input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="mileage">
              Current mileage
            </label>
            <input
              id="mileage"
              type="number"
              min={0}
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="mot_expiry_date">
            MOT expiry date{' '}
            <span className="font-normal text-slate-400">
              (optional — recalculated automatically once MOT records are added)
            </span>
          </label>
          <input
            id="mot_expiry_date"
            type="date"
            value={motExpiryDate}
            onChange={(e) => setMotExpiryDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.mot_expiry_date && (
            <p className="mt-1 text-sm text-red-600">{errors.mot_expiry_date}</p>
          )}
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
