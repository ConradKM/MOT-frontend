import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCustomer, useDeleteCustomer, useVehicles } from '../../api/queries'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../components/Toast'

export function CustomerDetail() {
  const { id: customerId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { data: customer, isLoading } = useCustomer(customerId)
  const { data: vehicles } = useVehicles({ customer_id: customerId })
  const deleteMutation = useDeleteCustomer()

  const handleDelete = async () => {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    try {
      await deleteMutation.mutateAsync(customerId as string)
      showToast('Customer deleted.', 'success')
      navigate('/customers')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>
  if (!customer) return <p className="text-sm text-red-600">Customer not found.</p>

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {customer.first_name} {customer.last_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {customer.email ?? 'No email'} · {customer.phone ?? 'No phone'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/customers/${customer.id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Vehicles</h2>
          <Link
            to={`/vehicles/new?customer_id=${customer.id}`}
            className="text-sm font-medium text-slate-900 hover:underline"
          >
            Add vehicle
          </Link>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {(!vehicles || vehicles.length === 0) && (
            <p className="p-4 text-sm text-slate-500">No vehicles on file.</p>
          )}
          {vehicles && vehicles.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Registration</th>
                  <th className="px-4 py-2 font-medium">Make / model</th>
                  <th className="px-4 py-2 font-medium">MOT expiry</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link to={`/vehicles/${v.id}`} className="font-medium text-slate-900 hover:underline">
                        {v.registration_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{v.mot_expiry_date ?? '—'}</td>
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
