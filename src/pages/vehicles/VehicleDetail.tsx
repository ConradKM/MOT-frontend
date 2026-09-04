import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useCreateMOTRecord,
  useCustomer,
  useDeleteVehicle,
  useGarage,
  useMOTRecords,
  useVehicle,
} from '../../api/queries'
import { MotBadge } from '../../components/MotBadge'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { useGarageId } from '../../hooks/useGarageId'
import { formatDateShort } from '../../lib/datetime'
import type { MOTResult } from '../../types'

export function VehicleDetail() {
  const garageId = useGarageId()
  const { id: vehicleId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { data: vehicle, isLoading } = useVehicle(vehicleId)
  const { data: customer } = useCustomer(vehicle?.customer_id)
  const { data: garage } = useGarage()
  const { data: records } = useMOTRecords(vehicleId)
  const deleteMutation = useDeleteVehicle()
  const createRecordMutation = useCreateMOTRecord(vehicleId ?? '')

  const [showAddRecord, setShowAddRecord] = useState(false)
  const [motDate, setMotDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [result, setResult] = useState<MOTResult>('PASS')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const handleDeleteVehicle = async () => {
    if (!confirm('Delete this vehicle? This cannot be undone.')) return
    try {
      const result = await deleteMutation.mutateAsync(vehicleId as string)
      showToast(
        result.archived
          ? 'This vehicle has MOT history or appointments on file, so it was archived rather than deleted.'
          : 'Vehicle deleted.',
        'success',
      )
      navigate(`/${garageId}/vehicles`)
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const handleAddRecord = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    try {
      await createRecordMutation.mutateAsync({
        mot_date: motDate,
        // A FAIL never grants a new expiry - the backend defaults it to
        // mot_date itself when omitted (see app/mot_records/routes.py).
        expiry_date: result === 'FAIL' ? null : expiryDate,
        result,
        notes: notes || null,
      })
      setShowAddRecord(false)
      setMotDate('')
      setExpiryDate('')
      setResult('PASS')
      setNotes('')
      showToast('MOT record added.', 'success')
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>
  if (!vehicle) return <p className="text-sm text-red-600">Vehicle not found.</p>

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{vehicle.registration_number}</h1>
            <MotBadge motExpiryDate={vehicle.mot_expiry_date} />
            {!vehicle.is_active && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                Archived
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'No details'}
            {vehicle.current_mileage !== null && ` · ${vehicle.current_mileage.toLocaleString()} mi`}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Owner:{' '}
            {customer ? (
              <Link to={`/${garageId}/customers/${customer.id}`} className="font-medium text-slate-900 hover:underline">
                {customer.first_name} {customer.last_name}
              </Link>
            ) : (
              '—'
            )}
            {customer && (
              <span className="text-slate-400">
                {' '}
                · {customer.email ?? 'No email'} · {customer.phone ?? 'No phone'}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            MOT expiry:{' '}
            {vehicle.mot_expiry_date ? formatDateShort(vehicle.mot_expiry_date) : 'No MOT records yet'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/${garageId}/vehicles/${vehicle.id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </Link>
          <button
            onClick={handleDeleteVehicle}
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              MOT history at {garage?.name ?? 'this garage'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              MOT tests recorded by this garage — not a full DVLA national history.
            </p>
          </div>
          <button
            onClick={() => setShowAddRecord((v) => !v)}
            className="text-sm font-medium text-slate-900 hover:underline"
          >
            {showAddRecord ? 'Cancel' : 'Add MOT record'}
          </button>
        </div>

        {showAddRecord && (
          <form
            onSubmit={handleAddRecord}
            className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-4"
          >
            {formError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="mot_date">
                  MOT date
                </label>
                <input
                  id="mot_date"
                  type="date"
                  required
                  value={motDate}
                  onChange={(e) => setMotDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
                {errors.mot_date && <p className="mt-1 text-sm text-red-600">{errors.mot_date}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="expiry_date">
                  Expiry date
                </label>
                <input
                  id="expiry_date"
                  type="date"
                  required={result === 'PASS'}
                  disabled={result === 'FAIL'}
                  value={result === 'FAIL' ? '' : expiryDate}
                  placeholder={result === 'FAIL' ? 'Not applicable' : undefined}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
                {result === 'FAIL' ? (
                  <p className="mt-1 text-xs text-slate-400">
                    A failed test doesn't grant a new expiry.
                  </p>
                ) : (
                  errors.expiry_date && (
                    <p className="mt-1 text-sm text-red-600">{errors.expiry_date}</p>
                  )
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="result">
                  Result
                </label>
                <select
                  id="result"
                  value={result}
                  onChange={(e) => setResult(e.target.value as MOTResult)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="PASS">Pass</option>
                  <option value="FAIL">Fail</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={createRecordMutation.isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {createRecordMutation.isPending ? 'Saving…' : 'Save record'}
            </button>
          </form>
        )}

        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {(!records || records.length === 0) && (
            <p className="p-4 text-sm text-slate-500">No MOT records yet.</p>
          )}
          {records && records.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">MOT date</th>
                  <th className="px-4 py-2 font-medium">Expiry date</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...records]
                  .sort((a, b) => b.mot_date.localeCompare(a.mot_date))
                  .map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-slate-600">{formatDateShort(r.mot_date)}</td>
                      <td className="px-4 py-2 text-slate-600">{formatDateShort(r.expiry_date)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.result === 'PASS'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {r.result}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{r.notes ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
