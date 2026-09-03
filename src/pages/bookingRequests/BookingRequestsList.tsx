import { useState } from 'react'
import type { BookingRequest, BookingRequestStatus } from '../../api/bookingRequests'
import {
  useApproveBookingRequest,
  useAppointmentTypes,
  useEmployees,
  useBookingRequests,
  useRejectBookingRequest,
} from '../../api/queries'
import { useToast } from '../../components/Toast'
import { errorMessage } from '../../lib/errors'
import { formatDateTime, localInputValueToIso } from '../../lib/datetime'

const STATUS_TABS: BookingRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED']

const statusClasses: Record<BookingRequestStatus, string> = {
  PENDING: 'bg-violet-100 text-violet-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-slate-100 text-slate-500',
}

function employeeName(first: string | null, last: string | null, email: string): string {
  return [first, last].filter(Boolean).join(' ') || email
}

function ReviewRow({ request }: { request: BookingRequest }) {
  const { data: employees } = useEmployees()
  const { data: appointmentTypes } = useAppointmentTypes('ACTIVE')
  const approve = useApproveBookingRequest()
  const reject = useRejectBookingRequest()
  const { showToast } = useToast()

  const defaultStart =
    request.preferred_time
      ? `${request.preferred_date}T${request.preferred_time.slice(0, 5)}`
      : `${request.preferred_date}T09:00`

  const [open, setOpen] = useState<'approve' | 'reject' | null>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [startLocal, setStartLocal] = useState(defaultStart)
  const [typeId, setTypeId] = useState(request.appointment_type_id ?? '')
  const [staffNotes, setStaffNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submitApprove = async () => {
    setError(null)
    try {
      await approve.mutateAsync({
        id: request.id,
        data: {
          employee_id: employeeId,
          appointment_type_id: typeId || null,
          start_time: localInputValueToIso(startLocal),
          staff_notes: staffNotes || null,
        },
      })
      showToast('Booking approved — appointment created.', 'success')
      setOpen(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const submitReject = async () => {
    setError(null)
    try {
      await reject.mutateAsync({ id: request.id, staff_notes: staffNotes || null })
      showToast('Booking request rejected.', 'success')
      setOpen(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-2">
          <p className="font-medium text-slate-900">
            {request.customer_first_name} {request.customer_last_name}
          </p>
          <p className="text-xs text-slate-500">{request.customer_email}</p>
        </td>
        <td className="px-4 py-2 text-slate-600">{request.vehicle_registration}</td>
        <td className="px-4 py-2 text-slate-600">
          {request.preferred_date}
          {request.preferred_time ? ` · ${request.preferred_time.slice(0, 5)}` : ''}
        </td>
        <td className="px-4 py-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[request.status]}`}
          >
            {request.status}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          {request.status === 'PENDING' ? (
            <div className="flex justify-end gap-3 text-sm font-medium">
              <button
                onClick={() => setOpen(open === 'approve' ? null : 'approve')}
                className="text-slate-900 hover:underline"
              >
                Approve
              </button>
              <button
                onClick={() => setOpen(open === 'reject' ? null : 'reject')}
                className="text-slate-500 hover:underline"
              >
                Reject
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">
              {request.reviewed_at ? formatDateTime(request.reviewed_at) : '—'}
            </span>
          )}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-slate-100 bg-slate-50 last:border-0">
          <td colSpan={5} className="px-4 py-4">
            {error && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            {request.notes && (
              <p className="mb-3 text-sm text-slate-600">
                <span className="font-medium">Customer note:</span> {request.notes}
              </p>
            )}

            {open === 'approve' ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    <span className="block font-medium text-slate-700">Assign to</span>
                    <select
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="">Select employee…</option>
                      {(employees ?? []).map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {employeeName(emp.first_name, emp.last_name, emp.email)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="block font-medium text-slate-700">Start</span>
                    <input
                      type="datetime-local"
                      value={startLocal}
                      onChange={(e) => setStartLocal(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block font-medium text-slate-700">Type</span>
                    <select
                      value={typeId}
                      onChange={(e) => setTypeId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="">Select type…</option>
                      {(appointmentTypes ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={submitApprove}
                    disabled={approve.isPending || !employeeId || !typeId}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {approve.isPending ? 'Approving…' : 'Approve & create appointment'}
                  </button>
                  <button
                    onClick={() => setOpen(null)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="block font-medium text-slate-700">Reason (optional)</span>
                  <textarea
                    rows={2}
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    className="mt-1 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={submitReject}
                    disabled={reject.isPending}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {reject.isPending ? 'Rejecting…' : 'Reject request'}
                  </button>
                  <button
                    onClick={() => setOpen(null)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function BookingRequestsList() {
  const [status, setStatus] = useState<BookingRequestStatus>('PENDING')
  const { data: requests, isLoading } = useBookingRequests(status)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Booking requests</h1>
      <p className="mt-1 text-sm text-slate-500">
        Requests submitted through your public booking page. Approving one creates the customer,
        vehicle and appointment.
      </p>

      <div className="mt-6 flex gap-1">
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
            {tab[0] + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
        ) : requests && requests.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Preferred</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <ReviewRow key={r.id} request={r} />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-3 text-sm text-slate-500">
            No {status.toLowerCase()} booking requests.
          </p>
        )}
      </div>
    </div>
  )
}
