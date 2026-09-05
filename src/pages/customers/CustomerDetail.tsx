import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCustomer, useCustomerCommunications, useDeleteCustomer, useVehicles } from '../../api/queries'
import { errorMessage } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { useGarageId } from '../../hooks/useGarageId'
import { formatDateShort, formatDateTime } from '../../lib/datetime'
import { ContactShortcuts } from '../../components/communications/ContactShortcuts'
import {
  callStatusBadgeClass,
  callStatusLabel,
  directionLabel,
  whatsappStatusBadgeClass,
  whatsappStatusLabel,
} from '../../lib/communications'

export function CustomerDetail() {
  const garageId = useGarageId()
  const { id: customerId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { data: customer, isLoading } = useCustomer(customerId)
  // include_inactive: an archived-but-historical vehicle must stay visible
  // here even though it's hidden from the garage-wide vehicles list.
  const { data: vehicles } = useVehicles({ customer_id: customerId, include_inactive: true })
  const { data: communications } = useCustomerCommunications(customerId)
  const deleteMutation = useDeleteCustomer()

  const handleDelete = async () => {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    try {
      const result = await deleteMutation.mutateAsync(customerId as string)
      if (result.archived) {
        showToast(
          'This customer has vehicles or appointments on file, so they were archived rather than deleted.',
          'success',
        )
        navigate(`/${garageId}/customers`)
      } else {
        showToast('Customer deleted.', 'success')
        navigate(`/${garageId}/customers`)
      }
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              {customer.first_name} {customer.last_name}
            </h1>
            {!customer.is_active && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                Archived
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {customer.email ?? 'No email'} · {customer.phone ?? 'No phone'}
          </p>
          <ContactShortcuts customerId={customer.id} phone={customer.phone} className="mt-3" />
        </div>
        <div className="flex gap-2">
          <Link
            to={`/${garageId}/customers/${customer.id}/edit`}
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
            to={`/${garageId}/vehicles/new?customer_id=${customer.id}`}
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
                      <Link to={`/${garageId}/vehicles/${v.id}`} className="font-medium text-slate-900 hover:underline">
                        {v.registration_number}
                      </Link>
                      {!v.is_active && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {v.mot_expiry_date ? formatDateShort(v.mot_expiry_date) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Communications</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {(!communications || communications.length === 0) && (
            <p className="p-4 text-sm text-slate-500">
              No calls or WhatsApp messages with this customer yet.
            </p>
          )}
          {communications && communications.length > 0 && (
            <div className="divide-y divide-slate-100">
              {communications.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {c.channel === 'WHATSAPP' ? 'WhatsApp' : 'Phone'} · {directionLabel(c.direction)}
                    </p>
                    {c.body && <p className="mt-0.5 text-sm text-slate-600">&ldquo;{c.body}&rdquo;</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">{formatDateTime(c.created_at)}</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.channel === 'WHATSAPP'
                          ? whatsappStatusBadgeClass(c.status)
                          : callStatusBadgeClass(c)
                      }`}
                    >
                      {c.channel === 'WHATSAPP' ? whatsappStatusLabel(c.status) : callStatusLabel(c)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
