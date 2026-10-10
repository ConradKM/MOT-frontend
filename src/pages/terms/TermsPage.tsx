import { Link, useParams } from 'react-router-dom'
import { usePublicTerms } from '../../api/queries'
import { BusinessBrandMark } from '../../components/BusinessBrandMark'
import { termsPath } from '../../lib/bookingUrl'
import { formatLongDate, localDateKey } from '../../lib/datetime'

/**
 * A business's Terms & Conditions, as a standalone public page:
 * `/terms/:garageId` is always the current wording - what a business links to
 * from its own website - and `/terms/:garageId/v/:version` is one exact
 * wording, which is what booking confirmations link to so a later edit never
 * changes what a customer is shown they agreed to.
 *
 * Deliberately self-contained: no sign-in, no CAPTCHA, nothing read from
 * app state, so it works when opened cold from another site, and it prints.
 */
export function TermsPage() {
  const { garageId, version } = useParams<{ garageId: string; version?: string }>()
  const { data, isLoading, isError } = usePublicTerms(garageId, version)

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>

  if (isError || !data || !garageId) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
          Terms not found
        </h1>
        <p className="mt-2 text-slate-600">
          {version
            ? "We couldn't find that version of this business's terms and conditions."
            : "This business hasn't published any terms and conditions."}{' '}
          If you followed a link, check it with the business.
        </p>
        {garageId && (
          <Link to={`/book/${garageId}`} className="mt-4 inline-block text-sm font-medium underline">
            Go to their booking page
          </Link>
        )}
      </div>
    )
  }

  return (
    <article className="mx-auto max-w-2xl">
      <header className="mb-6 flex items-center gap-3">
        <BusinessBrandMark name={data.garage_name} logoUrl={data.logo_url} />
        <div>
          <p className="text-sm font-medium text-slate-500">{data.garage_name}</p>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">
            Terms and conditions
          </h1>
        </div>
      </header>

      {!data.is_current && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
          This is an earlier version of these terms.{' '}
          <Link to={termsPath(garageId)} className="font-medium underline">
            View the current terms
          </Link>
        </p>
      )}

      <div className="rounded-lg bg-white p-6 shadow-card print:p-0 print:shadow-none">
        <p className="text-xs text-slate-500">
          Version {data.version} · effective {formatLongDate(localDateKey(data.effective_at))}
        </p>
        {/* Business-written content: always text, never HTML. */}
        <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
          {data.body}
        </div>
      </div>

      <div className="mt-4 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Print
        </button>
      </div>
    </article>
  )
}
