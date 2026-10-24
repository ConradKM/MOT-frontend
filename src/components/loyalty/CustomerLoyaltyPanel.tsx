import { Link } from 'react-router-dom'
import { useCustomerLoyalty } from '../../api/queries'
import { discountLabel } from '../../api/loyalty'
import { useGarageId } from '../../hooks/useGarageId'
import { StatusBadge } from './DiscountStatusBadge'

/** A customer's loyalty at a glance: completed visits, how far to the next
 * reward, and the codes they've been issued. Counts come from the server. */
export function CustomerLoyaltyPanel({ customerId }: { customerId: string }) {
  const garageId = useGarageId()
  const { data, isLoading, isError } = useCustomerLoyalty(customerId)

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Loyalty</h2>
        <Link
          to={`/${garageId}/settings/discounts`}
          className="text-sm font-medium text-slate-900 hover:underline"
        >
          Discounts settings
        </Link>
      </div>
      <div className="mt-3 rounded-lg bg-white p-4 text-sm text-slate-700 shadow-card">
        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : isError || !data ? (
          <p className="text-slate-500">Couldn't load loyalty details.</p>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Completed visits</dt>
                <dd className="mt-0.5 text-base font-semibold text-slate-900">{data.completed_visits}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Next reward</dt>
                <dd className="mt-0.5 text-slate-900">
                  {!data.enabled
                    ? 'Loyalty programme is off'
                    : data.visits_to_next_reward === 1
                      ? 'On the next completed visit'
                      : `In ${data.visits_to_next_reward} completed visits`}
                </dd>
              </div>
            </dl>
            {data.marketing_email_opt_out && (
              <p className="mt-3 text-slate-600">
                Opted out of offer emails - pass any codes on yourself.
              </p>
            )}
            {data.codes.length === 0 ? (
              <p className="mt-3 text-slate-500">No codes issued yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {data.codes.map((code) => (
                  <li key={code.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-mono font-semibold text-slate-900">{code.code}</span>{' '}
                      <span className="text-slate-600">
                        {discountLabel(code.discount_type, code.discount_value)}
                      </span>
                    </span>
                    <StatusBadge status={code.status} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
