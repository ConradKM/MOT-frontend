import { useSearchParams } from 'react-router-dom'
import { useUnsubscribe, useUnsubscribePreview } from '../api/queries'
import { errorMessage } from '../lib/errors'

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 text-center shadow-card" role="status">
      <h1 className="font-display text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  )
}

/**
 * Where the loyalty reward email's "Unsubscribe" link lands
 * (`/unsubscribe?token=…`). Opening the page changes nothing - mail scanners
 * that prefetch links must not opt anyone out - so the customer confirms
 * with a button. Only promotional email stops; booking confirmations and
 * reminders carry on.
 */
export function UnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const preview = useUnsubscribePreview(token)
  const unsubscribe = useUnsubscribe()

  if (!token) {
    return (
      <Notice title="This link is incomplete">
        Please open the full unsubscribe link from the email you were sent.
      </Notice>
    )
  }
  if (preview.isLoading) return <p className="text-center text-sm text-page-muted">Loading…</p>
  if (preview.isError || !preview.data) {
    return (
      <Notice title="This link isn't valid">
        Please use the unsubscribe link from the most recent email, or contact the business directly.
      </Notice>
    )
  }

  const business = preview.data.business_name
  if (unsubscribe.isSuccess || preview.data.unsubscribed) {
    return (
      <Notice title="You're unsubscribed">
        {business} won't send you offers by email any more. You'll still get booking confirmations
        and reminders.
      </Notice>
    )
  }

  return (
    <Notice title={`Stop offers from ${business}?`}>
      <p>
        You'll no longer get loyalty rewards or other offers by email. Booking confirmations and
        reminders are not affected.
      </p>
      {unsubscribe.isError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-red-700">{errorMessage(unsubscribe.error)}</p>
      )}
      <button
        type="button"
        onClick={() => unsubscribe.mutate(token)}
        disabled={unsubscribe.isPending}
        className="mt-4 inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {unsubscribe.isPending ? 'Unsubscribing…' : 'Unsubscribe'}
      </button>
    </Notice>
  )
}
