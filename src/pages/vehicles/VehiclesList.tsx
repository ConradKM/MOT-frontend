import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers, useVehicles } from '../../api/queries'
import { MotBadge } from '../../components/MotBadge'
import { useGarageId } from '../../hooks/useGarageId'
import { formatDateShort } from '../../lib/datetime'

export function VehiclesList() {
  const garageId = useGarageId()
  const [registration, setRegistration] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [motExpiryDate, setMotExpiryDate] = useState('')

  const { data: customers } = useCustomers()
  const {
    data: vehicles,
    isLoading,
    isError,
  } = useVehicles({
    registration: registration || undefined,
    customer_id: customerId || undefined,
    mot_expiry_date: motExpiryDate || undefined,
  })

  const customerName = (id: string) => {
    const c = customers?.find((c) => c.id === id)
    return c ? `${c.first_name} ${c.last_name}` : `#${id}`
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Vehicles</h1>
        <Link
          to={`/${garageId}/vehicles/new`}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New vehicle
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Registration…"
          value={registration}
          onChange={(e) => setRegistration(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">All customers</option>
          {customers?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          MOT expiry date
          <input
            type="date"
            value={motExpiryDate}
            onChange={(e) => setMotExpiryDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        {(registration || customerId || motExpiryDate) && (
          <button
            type="button"
            onClick={() => {
              setRegistration('')
              setCustomerId('')
              setMotExpiryDate('')
            }}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
        {isError && <p className="p-4 text-sm text-red-600">Failed to load vehicles.</p>}
        {vehicles && vehicles.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No vehicles found.</p>
        )}
        {vehicles && vehicles.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Registration</th>
                <th className="px-4 py-2 font-medium">Make / model</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">MOT expiry</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link to={`/${garageId}/vehicles/${v.id}`} className="font-medium text-slate-900 hover:underline">
                      {v.registration_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{customerName(v.customer_id)}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {v.mot_expiry_date ? formatDateShort(v.mot_expiry_date) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <MotBadge motExpiryDate={v.mot_expiry_date} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
