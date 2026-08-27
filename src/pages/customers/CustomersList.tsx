import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from '../../api/queries'

export function CustomersList() {
  const [search, setSearch] = useState('')
  const { data: customers, isLoading, isError } = useCustomers(search || undefined)

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
        <Link
          to="/customers/new"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New customer
        </Link>
      </div>

      <input
        type="search"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
        {isError && <p className="p-4 text-sm text-red-600">Failed to load customers.</p>}
        {customers && customers.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No customers found.</p>
        )}
        {customers && customers.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link to={`/customers/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{c.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
