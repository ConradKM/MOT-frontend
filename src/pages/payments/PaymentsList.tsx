import { Link } from 'react-router-dom'
import { useBookingRequests } from '../../api/queries'
import type { BookingPaymentStatus } from '../../api/bookingRequests'
import { formatDateTime } from '../../lib/datetime'
import { useGarageId } from '../../hooks/useGarageId'

const statusLabels: Record<BookingPaymentStatus, string> = {
  REQUIRES_PAYMENT: 'Pending',
  PENDING: 'Processing',
  SUCCEEDED: 'Paid',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  REFUND_PENDING: 'Refund processing',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUND_FAILED: 'Refund failed',
}

const statusClasses: Record<BookingPaymentStatus, string> = {
  REQUIRES_PAYMENT: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-amber-100 text-amber-700',
  SUCCEEDED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
  REFUND_PENDING: 'bg-amber-100 text-amber-700',
  REFUNDED: 'bg-slate-100 text-slate-700',
  PARTIALLY_REFUNDED: 'bg-slate-100 text-slate-700',
  REFUND_FAILED: 'bg-red-100 text-red-700',
}

function paymentDate(payment: { paid_at: string | null; refunded_at: string | null }): string {
  if (payment.refunded_at) return `Refunded ${formatDateTime(payment.refunded_at)}`
  if (payment.paid_at) return `Paid ${formatDateTime(payment.paid_at)}`
  return 'Not paid yet'
}

/** A deliberately small staff view over the payment data already returned by
 * the tenant-scoped booking-request API. It does not create a second source
 * of truth or expose provider references. */
export function PaymentsList() {
  const { data: requests, isLoading, isError } = useBookingRequests()
  const garageId = useGarageId()
  const paidRequests = (requests ?? []).filter((request) => request.payment !== null)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Deposits collected for your booking requests. Stripe remains the source of payment
            confirmation.
          </p>
        </div>
        <Link
          to={`/${garageId}/settings/payments`}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Payment settings
        </Link>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading payments…</p>}
      {isError && (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Payments could not be loaded. Please try again.
        </p>
      )}
      {!isLoading && !isError && paidRequests.length === 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No deposit payments yet.
        </div>
      )}
      {paidRequests.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Deposit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment / refund date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paidRequests.map((request) => {
                const payment = request.payment!
                const amount = new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: payment.currency,
                }).format(Number(payment.amount))
                return (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-slate-900">
                      <p className="font-medium">{request.customer_full_name}</p>
                      <p className="text-xs text-slate-500">{request.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{request.appointment_type?.name ?? 'Booking request'}</p>
                      <p className="text-xs text-slate-500">{request.preferred_date}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{amount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[payment.status]}`}>
                        {statusLabels[payment.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{paymentDate(payment)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
