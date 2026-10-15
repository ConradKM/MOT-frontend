import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getStripeConnectStatus,
  startStripeConnect,
  type SelectablePaymentProvider,
  type SquareConnectStatus,
  type StripeConnectStatus,
} from '../../api/payments'
import {
  useDisconnectSquare,
  usePaymentProvider,
  useSetPaymentProvider,
  useSetSquareLocation,
  useSquareStatus,
  useStartSquareConnect,
} from '../../api/queries'
import { useToast } from '../../components/Toast'
import { errorMessage, isApiError } from '../../lib/errors'

const PROVIDER_LABELS: Record<SelectablePaymentProvider, string> = {
  stripe: 'Stripe',
  square: 'Square',
}

const OWNER_ONLY = 'Only the business owner can manage payment settings.'

function describeError(err: unknown): string {
  return isApiError(err) && err.code === 403 ? OWNER_ONLY : errorMessage(err)
}

/** Owner-facing payments settings: which provider takes this business's
 * online deposits, and the connection for each. The API determines the
 * tenant from the access token; this page never sends a garage, connected-
 * account or merchant id supplied by the browser. */
export function PaymentsSettings() {
  const [searchParams] = useSearchParams()
  const providerQuery = usePaymentProvider()
  const active = providerQuery.data?.provider
  // Which card is on screen. Viewing a card never changes anything; making
  // it the active provider is an explicit button, so an owner can connect
  // Square fully before switching deposits over to it.
  const [returnedFromSquare] = useState(() => Boolean(searchParams.get('square')))
  const [picked, setPicked] = useState<SelectablePaymentProvider | null>(null)
  const viewing: SelectablePaymentProvider =
    picked ?? (returnedFromSquare || active === 'square' ? 'square' : 'stripe')

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Payments</h1>
      <p className="mt-1 text-sm text-slate-500">
        Choose Stripe or Square so customers can securely pay booking deposits to your business.
      </p>

      <div
        role="radiogroup"
        aria-label="Payment provider"
        className="mt-6 inline-flex rounded-lg bg-slate-100 p-1"
      >
        {(['stripe', 'square'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={viewing === name}
            onClick={() => setPicked(name)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              viewing === name ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {PROVIDER_LABELS[name]}
            {active === name && <span className="ml-2 text-xs text-emerald-700">Active</span>}
          </button>
        ))}
      </div>
      {providerQuery.isError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {describeError(providerQuery.error)}
        </p>
      )}

      <ActiveProviderBar provider={viewing} active={active} />

      {viewing === 'stripe' ? <StripeConnectCard /> : <SquareConnectCard />}
    </div>
  )
}

function ActiveProviderBar({
  provider,
  active,
}: {
  provider: SelectablePaymentProvider
  active: string | undefined
}) {
  const setProvider = useSetPaymentProvider()
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)
  if (active === undefined) return null

  if (active === provider) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        {PROVIDER_LABELS[provider]} takes your online deposits.
      </p>
    )
  }

  const choose = async () => {
    setError(null)
    try {
      await setProvider.mutateAsync(provider)
      showToast(`${PROVIDER_LABELS[provider]} now takes your online deposits.`, 'success')
    } catch (err) {
      setError(
        isApiError(err) && err.code === 409
          ? "A customer is paying a deposit right now, so the provider can't be changed. Please try again in a few minutes."
          : describeError(err),
      )
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void choose()}
        disabled={setProvider.isPending}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
      >
        {setProvider.isPending ? 'Switching…' : `Use ${PROVIDER_LABELS[provider]} for online deposits`}
      </button>
      <p className="mt-1 text-xs text-slate-500">
        Earlier deposits are always refunded through the provider that took them.
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

/** Stripe-hosted Connect onboarding - unchanged behaviour from before
 * Square existed. */
function StripeConnectCard() {
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
    <div className="mt-6 rounded-lg bg-white shadow-card p-5">
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
  )
}

/** What a `square_error` code on the return redirect means. Informational
 * only - the card's state always comes from GET /square/status. */
const SQUARE_RETURN_MESSAGES: Record<string, string> = {
  denied: 'Square connection was cancelled. You can try again whenever you are ready.',
  merchant_in_use: 'That Square account is already connected to another business on CoMaz.',
  secrets_not_configured: "Square can't be connected on CoMaz right now. Please contact CoMaz support.",
  not_configured: "Square can't be connected on CoMaz right now. Please contact CoMaz support.",
}

function SquareConnectCard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = useSquareStatus()
  const connect = useStartSquareConnect()
  const disconnect = useDisconnectSquare()
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [returnNotice] = useState(() => {
    const code = searchParams.get('square_error')
    if (!code) return null
    return SQUARE_RETURN_MESSAGES[code] ?? "Square couldn't be connected. Please try again."
  })

  // Drop the redirect's query string once read - it is never the source of
  // truth, and leaving it would re-show the notice on every refresh.
  useEffect(() => {
    if (searchParams.get('square') || searchParams.get('square_error')) {
      const next = new URLSearchParams(searchParams)
      next.delete('square')
      next.delete('square_error')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const startConnect = async () => {
    setError(null)
    try {
      const { url } = await connect.mutateAsync()
      window.location.assign(url)
    } catch (err) {
      setError(describeError(err))
    }
  }

  const doDisconnect = async () => {
    if (!window.confirm('Disconnect Square? Customers will not be able to pay deposits through Square until you reconnect.')) return
    setError(null)
    try {
      const result = await disconnect.mutateAsync()
      showToast(
        result.remote_revoke_confirmed
          ? 'Square disconnected.'
          : 'Square disconnected here. Also remove CoMaz from your Square Dashboard to be sure.',
        'success',
      )
    } catch (err) {
      setError(
        isApiError(err) && err.code === 409 && err.reason === 'payment_in_progress'
          ? "A customer is paying a deposit through Square right now, so it can't be disconnected yet. Please try again in a few minutes."
          : describeError(err),
      )
    }
  }

  const data = status.data
  return (
    <div className="mt-6 rounded-lg bg-white shadow-card p-5">
      {returnNotice && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{returnNotice}</p>
      )}
      {status.isLoading ? (
        <p className="text-sm text-slate-500">Checking Square connection…</p>
      ) : status.isError || !data ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {describeError(status.error)}
        </p>
      ) : !data.deployment_configured && data.status === 'NOT_CONNECTED' ? (
        <p className="text-sm text-slate-600">
          Square isn't available on CoMaz yet. Please contact CoMaz support.
        </p>
      ) : data.status === 'NOT_CONNECTED' ? (
        <>
          <p className="text-sm font-medium text-amber-700">Not connected</p>
          <p className="mt-2 text-sm text-slate-600">
            Connect your Square account to take card deposits. Payments go straight to your
            Square account.
          </p>
          <div className="mt-5">
            <button
              onClick={() => void startConnect()}
              disabled={connect.isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {connect.isPending ? 'Opening Square…' : 'Connect Square'}
            </button>
          </div>
        </>
      ) : data.status === 'REVOKED' || data.status === 'ERROR' ? (
        <>
          <p className="text-sm font-medium text-red-700">Needs attention</p>
          <p className="mt-2 text-sm text-slate-600">
            {data.status === 'REVOKED'
              ? "CoMaz's access to your Square account was removed, so online deposits are paused."
              : "We can't reach your Square account right now, so online deposits are paused."}{' '}
            Reconnect Square to start taking deposits again.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => void startConnect()}
              disabled={connect.isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {connect.isPending ? 'Opening Square…' : 'Reconnect Square'}
            </button>
            <DisconnectButton onClick={() => void doDisconnect()} pending={disconnect.isPending} />
          </div>
        </>
      ) : (
        <ConnectedSquare
          data={data}
          onDisconnect={() => void doDisconnect()}
          disconnecting={disconnect.isPending}
        />
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

function DisconnectButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
    >
      {pending ? 'Disconnecting…' : 'Disconnect'}
    </button>
  )
}

function ConnectedSquare({
  data,
  onDisconnect,
  disconnecting,
}: {
  data: SquareConnectStatus
  onDisconnect: () => void
  disconnecting: boolean
}) {
  const setLocation = useSetSquareLocation()
  const { showToast } = useToast()
  const eligible = data.locations.filter((loc) => loc.eligible)
  const [choice, setChoice] = useState(data.location_id ?? '')
  const [error, setError] = useState<string | null>(null)

  const saveLocation = async () => {
    setError(null)
    try {
      await setLocation.mutateAsync(choice)
      showToast('Square location saved.', 'success')
    } catch (err) {
      setError(describeError(err))
    }
  }

  return (
    <>
      <p className={`text-sm font-medium ${data.ready ? 'text-emerald-700' : 'text-amber-700'}`}>
        {data.ready ? 'Ready to take online payments' : 'Choose a location to finish setup'}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Square account</dt>
          <dd>{data.merchant_name ?? 'Connected'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Location</dt>
          <dd>{data.location_name ?? 'Not chosen'}</dd>
        </div>
        {data.environment === 'sandbox' && (
          <div>
            <dt className="text-slate-500">Mode</dt>
            <dd>Sandbox (test payments only)</dd>
          </div>
        )}
      </dl>

      {(eligible.length > 1 || !data.location_id) && (
        <div className="mt-4">
          <label htmlFor="square-location" className="block text-sm font-medium text-slate-700">
            Location that takes deposits
          </label>
          {eligible.length === 0 ? (
            <p className="mt-1 text-sm text-amber-700">
              None of your Square locations can take card payments in {data.currency}. Check your
              locations in the Square Dashboard, then refresh this page.
            </p>
          ) : (
            <div className="mt-1 flex gap-3">
              <select
                id="square-location"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Choose a location
                </option>
                {eligible.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name ?? loc.id}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void saveLocation()}
                disabled={!choice || choice === data.location_id || setLocation.isPending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {setLocation.isPending ? 'Saving…' : 'Save location'}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <DisconnectButton onClick={onDisconnect} pending={disconnecting} />
      </div>
    </>
  )
}
