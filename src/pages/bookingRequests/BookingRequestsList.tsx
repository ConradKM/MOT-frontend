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
import { employeeDisplayName } from '../../lib/employees'
import { formatDateShort, formatDateTime, localInputValueToIso } from '../../lib/datetime'
import { formatDurationMinutes } from '../../lib/duration'

const STATUS_TABS: BookingRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']

const statusClasses: Record<BookingRequestStatus, string> = {
  PENDING: 'bg-violet-100 text-violet-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-slate-100 text-slate-500',
  EXPIRED: 'bg-amber-100 text-amber-700',
}

const statusLabels: Record<BookingRequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
}

const priceFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

function formatPreferred(request: BookingRequest): string {
  const date = formatDateShort(request.preferred_date)
  return request.preferred_time ? `${date}, ${request.preferred_time.slice(0, 5)}` : date
}

function formatPrice(price: string | null | undefined): string {
  if (price === null || price === undefined) return '—'
  return priceFormatter.format(Number(price))
}

/** Plain-English reason a slot check failed - never expose the internal code. */
const SLOT_UNAVAILABLE_TEXT = 'This time slot is no longer available.'

function RequestDetails({ request }: { request: BookingRequest }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="font-medium text-slate-700">Customer</dt>
        <dd className="text-slate-600">
          {request.customer_first_name} {request.customer_last_name}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-slate-700">Contact</dt>
        <dd className="text-slate-600">
          {request.customer_email}
          {request.customer_phone ? ` · ${request.customer_phone}` : ''}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-slate-700">Vehicle</dt>
        <dd className="text-slate-600">
          {request.vehicle_registration}
          {' — '}
          {[request.vehicle_make, request.vehicle_model, request.vehicle_year]
            .filter(Boolean)
            .join(' ') || 'details not given'}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-slate-700">Mileage</dt>
        <dd className="text-slate-600">
          {request.vehicle_mileage !== null
            ? `${request.vehicle_mileage.toLocaleString()} mi`
            : 'Not given'}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-slate-700">Service</dt>
        <dd className="text-slate-600">
          {request.appointment_type?.name ?? 'Not specified'}
          {' · '}
          {formatDurationMinutes(request.duration_minutes)}
          {' · '}
          {formatPrice(request.appointment_type?.base_price ?? request.requested_price)}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-slate-700">Preferred date/time</dt>
        <dd className="text-slate-600">{formatPreferred(request)}</dd>
      </div>
      {request.preferred_employee_note && (
        <div>
          <dt className="font-medium text-slate-700">Preferred mechanic</dt>
          <dd className="text-slate-600">{request.preferred_employee_note}</dd>
        </div>
      )}
      <div>
        <dt className="font-medium text-slate-700">Availability</dt>
        <dd className="text-slate-600">
          {!request.slot_check.checked
            ? 'Not applicable'
            : request.slot_check.available
              ? 'Still available'
              : SLOT_UNAVAILABLE_TEXT}
        </dd>
      </div>
      {request.notes && (
        <div className="sm:col-span-2">
          <dt className="font-medium text-slate-700">Customer notes</dt>
          <dd className="whitespace-pre-wrap text-slate-600">{request.notes}</dd>
        </div>
      )}
      {request.status !== 'PENDING' && (
        <div className="sm:col-span-2">
          <dt className="font-medium text-slate-700">Decision</dt>
          <dd className="text-slate-600">
            {statusLabels[request.status]}
            {request.reviewed_by_name ? ` by ${request.reviewed_by_name}` : ''}
            {request.reviewed_at ? ` · ${formatDateTime(request.reviewed_at)}` : ''}
            {request.staff_notes ? ` — "${request.staff_notes}"` : ''}
          </dd>
        </div>
      )}
    </dl>
  )
}

function ReviewRow({ request }: { request: BookingRequest }) {
  const { data: employees } = useEmployees()
  const { data: appointmentTypes } = useAppointmentTypes('ACTIVE')
  const approve = useApproveBookingRequest()
  const reject = useRejectBookingRequest()
  const { showToast } = useToast()

  const activeEmployees = (employees ?? []).filter((e) => e.is_active)

  const defaultStart = request.preferred_time
    ? `${request.preferred_date}T${request.preferred_time.slice(0, 5)}`
    : `${request.preferred_date}T09:00`

  const [open, setOpen] = useState<'view' | 'approve' | 'reject' | null>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [startLocal, setStartLocal] = useState(defaultStart)
  const [typeId, setTypeId] = useState(request.appointment_type_id ?? '')
  const [staffNotes, setStaffNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDespiteConflict, setConfirmDespiteConflict] = useState(false)

  const isPending = request.status === 'PENDING'
  const slotLooksFull = request.slot_check.checked && request.slot_check.available === false

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
          <p className="font-medium text-slate-900">{request.customer_full_name}</p>
          <p className="text-xs text-slate-500">{request.customer_email}</p>
        </td>
        <td className="px-4 py-2 text-slate-600">
          <p className="font-medium text-slate-900">{request.vehicle_registration}</p>
          <p className="text-xs text-slate-500">
            {[request.vehicle_make, request.vehicle_model].filter(Boolean).join(' ') || '—'}
          </p>
        </td>
        <td className="px-4 py-2 text-slate-600">
          <p>{request.appointment_type?.name ?? 'Not specified'}</p>
          <p className="text-xs text-slate-500">
            {formatDurationMinutes(request.duration_minutes)} ·{' '}
            {formatPrice(request.appointment_type?.base_price)}
          </p>
        </td>
        <td className="px-4 py-2 text-slate-600">{formatPreferred(request)}</td>
        <td className="px-4 py-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[request.status]}`}
          >
            {statusLabels[request.status]}
          </span>
          {isPending && slotLooksFull && (
            <p className="mt-1 text-xs text-amber-700">Slot may be full</p>
          )}
        </td>
        <td className="px-4 py-2 text-right">
          {isPending ? (
            <div className="flex justify-end gap-3 text-sm font-medium">
              <button
                onClick={() => setOpen(open === 'view' ? null : 'view')}
                className="text-slate-500 hover:underline"
              >
                View
              </button>
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
            <div className="flex justify-end items-center gap-3 text-sm">
              <button
                onClick={() => setOpen(open === 'view' ? null : 'view')}
                className="font-medium text-slate-500 hover:underline"
              >
                View
              </button>
              <span className="text-xs text-slate-400">
                {request.reviewed_at ? formatDateTime(request.reviewed_at) : '—'}
              </span>
            </div>
          )}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-slate-100 bg-slate-50 last:border-0">
          <td colSpan={6} className="px-4 py-4">
            {error && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <RequestDetails request={request} />

            {open === 'approve' && (
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                {slotLooksFull && !confirmDespiteConflict && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {SLOT_UNAVAILABLE_TEXT} You can still approve it against a different time
                    below, or{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setConfirmDespiteConflict(true)}
                    >
                      approve anyway
                    </button>
                    .
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    <span className="block font-medium text-slate-700">Assign to</span>
                    <select
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    >
                      <option value="">Select employee…</option>
                      {activeEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {employeeDisplayName(emp)}
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
            )}

            {open === 'reject' && (
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
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

            {open === 'view' && isPending && (
              <div className="mt-4 flex gap-3 border-t border-slate-200 pt-4 text-sm font-medium">
                <button onClick={() => setOpen('approve')} className="text-slate-900 hover:underline">
                  Approve…
                </button>
                <button onClick={() => setOpen('reject')} className="text-slate-500 hover:underline">
                  Reject…
                </button>
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
        vehicle and appointment. Requests left unreviewed past their preferred time expire
        automatically.
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
            {statusLabels[tab]}
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
                <th className="px-4 py-2 font-medium">Service</th>
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
            No {statusLabels[status].toLowerCase()} booking requests.
          </p>
        )}
      </div>
    </div>
  )
}
