import { useEffect, useState } from 'react'
import {
  getStripeConnectStatus,
  startStripeConnect,
  type StripeConnectStatus,
} from '../../api/payments'
import { errorMessage } from '../../lib/errors'
import { SettingsLayout } from '../../components/settings/SettingsLayout'

/** Owner-facing launch/recovery point for Stripe-hosted Connect onboarding.
 * The API determines the tenant from the access token; this page never sends
 * a garage or connected-account id supplied by the browser. */
export function PaymentsSettings() {
  const [status, setStatus] = useState<StripeConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const refresh = () => {
    setLoading(true)
    getStripeConnectStatus()
      .then(setStatus)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const connect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const { url } = await startStripeConnect()
      window.location.assign(url)
    } catch (err) {
      setError(errorMessage(err))
      setConnecting(false)
    }
  }

  const ready = Boolean(status?.stripe_charges_enabled)
  return (
    <SettingsLayout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect Stripe so customers can securely pay booking deposits to your business.
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {loading ? (
            <p className="text-sm text-slate-500">Checking Stripe connection…</p>
          ) : (
            <>
              <p className={`text-sm font-medium ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                {ready ? 'Ready to take online payments' : 'Stripe setup is incomplete'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {ready
                  ? 'Your connected Stripe account can accept deposit payments.'
                  : status?.stripe_account_id
                    ? 'Continue Stripe setup to enable card and wallet payments.'
                    : 'Start Stripe setup to enable card and wallet payments.'}
              </p>
              {status?.stripe_account_id && (
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-slate-500">Onboarding</dt><dd>{status.stripe_onboarding_complete ? 'Complete' : 'In progress'}</dd></div>
                  <div><dt className="text-slate-500">Payouts</dt><dd>{status.stripe_payouts_enabled ? 'Enabled' : 'Not enabled'}</dd></div>
                  {status.apple_pay_status && (
                    <div>
                      <dt className="text-slate-500">Apple Pay</dt>
                      <dd>
                        {status.apple_pay_status === 'active'
                          ? 'Active'
                          : status.apple_pay_status === 'pending'
                            ? 'Verifying with Stripe…'
                            : status.apple_pay_status_details || 'Not available'}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              <div className="mt-5 flex gap-3">
                <button onClick={() => void connect()} disabled={connecting} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {connecting ? 'Opening Stripe…' : status?.stripe_account_id ? 'Continue Stripe setup' : 'Connect Stripe'}
                </button>
                <button onClick={refresh} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Refresh status</button>
              </div>
            </>
          )}
          {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </SettingsLayout>
  )
}
