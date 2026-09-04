import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers, useVehicles } from '../../api/queries'
import { MotBadge } from '../../components/MotBadge'
import { formatDateShort } from '../../lib/datetime'
import { useGarageId } from '../../hooks/useGarageId'
import type { Customer, Vehicle } from '../../types'

interface Row {
  customer: Customer
  vehicles: Vehicle[]
}

/** The soonest MOT expiry across a customer's vehicles - an overdue one
 * sorts first (it's the smallest date), so this is naturally "whichever
 * needs attention first", not just "whichever is due soonest in future". */
function nearestExpiry(vehicles: Vehicle[]): string | null {
  const dates = vehicles.map((v) => v.mot_expiry_date).filter((d): d is string => !!d)
  return dates.length > 0 ? dates.sort()[0] : null
}

function matches(row: Row, q: string): boolean {
  if (!q) return true
  const c = row.customer
  const haystack = [
    `${c.first_name} ${c.last_name}`,
    c.email,
    c.phone,
    ...row.vehicles.flatMap((v) => [v.registration_number, v.make, v.model]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function CustomersList() {
  const garageId = useGarageId()
  const [search, setSearch] = useState('')

  const { data: customers, isLoading: cLoading, isError: cError } = useCustomers()
  const { data: vehicles, isLoading: vLoading, isError: vError } = useVehicles()

  const rows = useMemo<Row[]>(() => {
    if (!customers) return []
    const byCustomer = new Map<string, Vehicle[]>()
    for (const v of vehicles ?? []) {
      const list = byCustomer.get(v.customer_id) ?? []
      list.push(v)
      byCustomer.set(v.customer_id, list)
    }
    return customers.map((customer) => ({
      customer,
      vehicles: byCustomer.get(customer.id) ?? [],
    }))
  }, [customers, vehicles])

  const q = search.trim().toLowerCase()
  const filtered = rows.filter((r) => matches(r, q))
  const isLoading = cLoading || vLoading
  const isError = cError || vError

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
        <Link
          to={`/${garageId}/customers/new`}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New customer
        </Link>
      </div>

      <input
        type="search"
        placeholder="Search name, email, phone, registration, make or model…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
        {isError && <p className="p-4 text-sm text-red-600">Failed to load customers.</p>}
        {!isLoading && !isError && filtered.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No matches.</p>
        )}
        {filtered.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Vehicles</th>
                <th className="px-4 py-2 font-medium">Next MOT expiry</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ customer, vehicles }) => {
                const expiry = nearestExpiry(vehicles)
                return (
                  <tr
                    key={customer.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2">
                      <Link
                        to={`/${garageId}/customers/${customer.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {customer.first_name} {customer.last_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{customer.phone ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{customer.email ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {vehicles.length === 0
                        ? 'No vehicles'
                        : `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {expiry ? formatDateShort(expiry) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {expiry ? <MotBadge motExpiryDate={expiry} /> : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
