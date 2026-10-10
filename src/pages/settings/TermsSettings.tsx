import { useState, type FormEvent } from 'react'
import type { GarageTerms } from '../../api/terms'
import { useGarageTerms, useUpdateGarageTerms } from '../../api/queries'
import { BookingQrCard } from '../../components/BookingQrCard'
import { useToast } from '../../components/Toast'
import { useGarageId } from '../../hooks/useGarageId'
import { termsUrl } from '../../lib/bookingUrl'
import { formatDateTime } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'

/** Mirrors app/terms/service.py::MAX_TERMS_LENGTH - the server is the
 * authority (422 beyond it); this just stops a customer-facing surprise. */
const MAX_LENGTH = 50_000

/**
 * The business's own Terms & Conditions. While there are any, every
 * customer-facing way of booking asks the customer to accept them; empty
 * turns that off. Plain text only - line breaks are kept, nothing else is
 * formatted, and customers always see it as text.
 */
export function TermsSettings() {
  const { data, isLoading, isError } = useGarageTerms()

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
        Terms &amp; Conditions
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Customers must accept these before booking - online, in the walk-in queue, and for
        bookings made by WhatsApp, text or phone. Only the business owner can change them.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
      {isError && <p className="mt-6 text-sm text-red-600">Failed to load your terms.</p>}
      {/* Remounted when a save produces a new version (or turns terms on or
          off), so the box shows exactly what was stored. */}
      {data && (
        <TermsForm key={`${data.terms_version}-${Boolean(data.terms_and_conditions)}`} data={data} />
      )}
    </div>
  )
}

function TermsForm({ data }: { data: GarageTerms }) {
  const garageId = useGarageId()
  const update = useUpdateGarageTerms()
  const { showToast } = useToast()

  const [text, setText] = useState(data.terms_and_conditions ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const saved = await update.mutateAsync(text)
      showToast(
        saved.terms_and_conditions
          ? 'Terms and conditions saved.'
          : 'Terms and conditions removed - customers no longer need to accept any.',
        'success',
      )
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setError('Only the business owner can change the terms and conditions.')
      } else {
        setError(fieldErrors(err).terms_and_conditions ?? errorMessage(err))
      }
    }
  }

  const tooLong = text.length > MAX_LENGTH

  return (
    <>
      <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="terms-text" className="block text-sm font-medium text-slate-700">
            Terms and conditions
          </label>
          <p id="terms-help" className="mt-0.5 text-xs text-slate-500">
            Customers must accept these before booking. Leave empty to turn this off.
          </p>
          <textarea
            id="terms-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            aria-describedby="terms-help terms-count"
            aria-invalid={tooLong || undefined}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-slate-500 focus:outline-none"
          />
          <p
            id="terms-count"
            className={`mt-1 text-right text-xs ${tooLong ? 'text-red-600' : 'text-slate-500'}`}
          >
            {text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()} characters
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={update.isPending || tooLong}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
          {data.terms_version != null && data.terms_updated_at && (
            <p className="text-xs text-slate-500">
              Version {data.terms_version}, in effect since{' '}
              {formatDateTime(data.terms_updated_at)}. Editing the wording creates a new
              version; past bookings keep the one they accepted.
            </p>
          )}
        </div>
      </form>

      {data.terms_and_conditions && (
        <BookingQrCard
          garageId={garageId}
          url={termsUrl(garageId)}
          title="Public terms page"
          description="Link to your terms from your own website. This page always shows your current version."
          filenameStem="terms-qr"
          qrLabel="Terms and conditions page QR code"
        />
      )}
    </>
  )
}
