import { useState } from 'react'
import {
  useCallbackRequests,
  useCancelCallbackRequest,
  useCompleteCallbackRequest,
} from '../../api/queries'
import { useToast } from '../../components/Toast'
import { errorMessage } from '../../lib/errors'
import { formatDateTime } from '../../lib/datetime'
import { ContactShortcuts } from '../../components/communications/ContactShortcuts'
import type { CallbackRequest, CallbackStatus } from '../../api/communications'

const STATUS_TABS: CallbackStatus[] = ['PENDING', 'COMPLETED', 'CANCELLED']

const statusLabels: Record<CallbackStatus, string> = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const statusClasses: Record<CallbackStatus, string> = {
  PENDING: 'bg-violet-100 text-violet-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

function CallbackRow({ callback }: { callback: CallbackRequest }) {
  const { showToast } = useToast()
  const complete = useCompleteCallbackRequest()
  const cancel = useCancelCallbackRequest()

  const name = callback.customer
    ? `${callback.customer.first_name} ${callback.customer.last_name}`
    : 'Unknown number'

  const handle = async (action: 'complete' | 'cancel') => {
    try {
      if (action === 'complete') await complete.mutateAsync(callback.id)
      else await cancel.mutateAsync(callback.id)
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const busy = complete.isPending || cancel.isPending

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-400">{callback.phone_number}</p>
        <ContactShortcuts phone={callback.phone_number} name={name} className="mt-1.5" />
      </td>
      <td className="px-4 py-3 align-top text-slate-600">{callback.reason ?? '—'}</td>
      <td className="px-4 py-3 align-top text-slate-600">{callback.preferred_time ?? '—'}</td>
      <td className="px-4 py-3 align-top text-slate-500">{formatDateTime(callback.created_at)}</td>
      <td className="px-4 py-3 align-top">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[callback.status]}`}
        >
          {statusLabels[callback.status]}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        {callback.status === 'PENDING' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handle('complete')}
              disabled={busy}
              className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => handle('cancel')}
              disabled={busy}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export function CallbackRequestsList() {
  const [status, setStatus] = useState<CallbackStatus>('PENDING')
  const { data, isLoading } = useCallbackRequests({ status })
  const items = data?.items ?? []

  return (
    <div>
      <p className="text-sm text-slate-500">
        Customers who asked the automated assistant for someone to call them back.
      </p>

      <div className="mt-4 flex gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatus(tab)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === tab
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {statusLabels[tab]}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No {statusLabels[status].toLowerCase()} callback requests.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium">Preferred time</th>
                <th className="px-4 py-2 font-medium">Requested</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((callback) => (
                <CallbackRow key={callback.id} callback={callback} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
