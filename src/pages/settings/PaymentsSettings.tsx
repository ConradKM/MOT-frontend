import { useEffect, useState, type ReactNode } from 'react'
import {
  CircleCheck,
  CircleDashed,
  Link2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
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
import { InfoTip } from '../../components/settings/InfoTip'
import { SettingsPageHeader } from '../../components/settings/SettingsUI'
import { errorMessage, isApiError } from '../../lib/errors'

const PROVIDER_LABELS: Record<SelectablePaymentProvider, string> = {
  stripe: 'Stripe',
  square: 'Square',
}

const OWNER_ONLY = 'Only the business owner can manage payment settings.'

function describeError(err: unknown): string {
  return isApiError(err) && err.code === 403 ? OWNER_ONLY : errorMessage(err)
}

type ProviderBadge = 'active' | 'connected' | 'not_connected' | 'needs_attention'

const BADGES: Record<ProviderBadge, { label: string; className: string; Icon: LucideIcon }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800', Icon: CircleCheck },
  connected: { label: 'Connected', className: 'bg-sky-100 text-sky-800', Icon: Link2 },
  not_connected: { label: 'Not connected', className: 'bg-slate-100 text-slate-700', Icon: CircleDashed },
  needs_attention: {
    label: 'Needs attention',
    className: 'bg-amber-100 text-amber-900',
    Icon: TriangleAlert,
  },
}

/** Owner-facing payments settings: Stripe and Square side by side, each with
 * its status and its own actions, and a clear mark on the one that takes
 * this business's online deposits. The API determines the tenant from the
 * access token; this page never sends a garage, connected-account or
 * merchant id supplied by the browser. */
export function PaymentsSettings() {
  const providerQuery = usePaymentProvider()
  const active = providerQuery.data?.provider

  return (
    <div className="max-w-4xl">
      <SettingsPageHeader
        title="Payments"
        info="Choose Stripe or Square so customers can securely pay booking deposits to your business."
      />
      {providerQuery.isError && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {describeError(providerQuery.error)}
        </p>
      )}

      <div className="mt-6 grid items-start gap-4 md:grid-cols-2">
        <StripeConnectCard active={active} />
        <SquareConnectCard active={active} />
      </div>
    </div>
  )
}

/**
 * The provider's brand mark. Official logo files belong in
 * src/assets/payments/ (stripe.svg, square.svg), used unmodified with their
 * brand guidelines; until they are supplied this is a neutral text
 * wordmark - never a drawn approximation of the logo.
 */
function ProviderLogo({ provider }: { provider: SelectablePaymentProvider }) {
  return (
    <span className="font-display text-xl font-semibold tracking-tight text-slate-900">
      {PROVIDER_LABELS[provider]}
    </span>
  )
}

function ProviderCard({
  provider,
  active,
  badge,
  children,
}: {
  provider: SelectablePaymentProvider
  active: string | undefined
  badge: ProviderBadge | null
  children: ReactNode
}) {
  const isActive = active === provider
  const headingId = `payments-${provider}-heading`
  const shown = badge ? BADGES[badge] : null
  return (
    <section
      aria-labelledby={headingId}
      data-testid={`payments-card-${provider}`}
      className={`rounded-lg bg-white p-5 shadow-card ${isActive ? 'ring-2 ring-slate-900' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId}>
          <ProviderLogo provider={provider} />
        </h2>
        {shown && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${shown.className}`}
          >
            <shown.Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {shown.label}
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
      <UseForDeposits provider={provider} active={active} />
    </section>
  )
}

function UseForDeposits({
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
      <p className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-medium text-slate-900">
        <CircleCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
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
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void choose()}
          disabled={setProvider.isPending}
          className={SECONDARY_BUTTON}
        >
          {setProvider.isPending
            ? 'Switching…'
            : `Use ${PROVIDER_LABELS[provider]} for online deposits`}
        </button>
        <InfoTip label="switching provider">
          Earlier deposits are always refunded through the provider that took them.
        </InfoTip>
      </div>
      {error && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

const PRIMARY_BUTTON =
  'min-h-11 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'
const SECONDARY_BUTTON =
  'min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'

/** Stripe-hosted Connect onboarding - unchanged behaviour from before
 * Square existed. */
function StripeConnectCard({ active }: { active: string | undefined }) {
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
  const badge: ProviderBadge | null = loading
    ? null
    : ready
      ? active === 'stripe'
        ? 'active'
        : 'connected'
      : status?.stripe_account_id
        ? 'needs_attention'
        : 'not_connected'
  return (
    <ProviderCard provider="stripe" active={active} badge={badge}>
      {loading ? (
        <p className="text-sm text-slate-500">Checking Stripe connection…</p>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-900">
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
              <div><dt className="text-slate-600">Onboarding</dt><dd>{status.stripe_onboarding_complete ? 'Complete' : 'In progress'}</dd></div>
              <div><dt className="text-slate-600">Payouts</dt><dd>{status.stripe_payouts_enabled ? 'Enabled' : 'Not enabled'}</dd></div>
              {status.apple_pay_status && (
                <div>
                  <dt className="text-slate-600">Apple Pay</dt>
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
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => void connect()} disabled={connecting} className={PRIMARY_BUTTON}>
              {connecting ? 'Opening Stripe…' : status?.stripe_account_id ? 'Continue Stripe setup' : 'Connect Stripe'}
            </button>
            <button onClick={refresh} className={SECONDARY_BUTTON}>Refresh status</button>
          </div>
        </>
      )}
      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </ProviderCard>
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

function SquareConnectCard({ active }: { active: string | undefined }) {
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
  const badge: ProviderBadge | null =
    status.isLoading || status.isError || !data
      ? null
      : data.status === 'NOT_CONNECTED'
        ? 'not_connected'
        : data.status === 'REVOKED' || data.status === 'ERROR' || !data.ready
          ? 'needs_attention'
          : active === 'square'
            ? 'active'
            : 'connected'
  return (
    <ProviderCard provider="square" active={active} badge={badge}>
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
          <p className="text-sm text-slate-700">
            Connect your Square account to take card deposits. Payments go straight to your
            Square account.
          </p>
          <div className="mt-5">
            <button
              onClick={() => void startConnect()}
              disabled={connect.isPending}
              className={PRIMARY_BUTTON}
            >
              {connect.isPending ? 'Opening Square…' : 'Connect Square'}
            </button>
          </div>
        </>
      ) : data.status === 'REVOKED' || data.status === 'ERROR' ? (
        <>
          <p className="text-sm text-slate-700">
            {data.status === 'REVOKED'
              ? "CoMaz's access to your Square account was removed, so online deposits are paused."
              : "We can't reach your Square account right now, so online deposits are paused."}{' '}
            Reconnect Square to start taking deposits again.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => void startConnect()}
              disabled={connect.isPending}
              className={PRIMARY_BUTTON}
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
    </ProviderCard>
  )
}

function DisconnectButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={SECONDARY_BUTTON}
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
      <p className="text-sm font-medium text-slate-900">
        {data.ready ? 'Ready to take online payments' : 'Choose a location to finish setup'}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-600">Square account</dt>
          <dd>{data.merchant_name ?? 'Connected'}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Location</dt>
          <dd>{data.location_name ?? 'Not chosen'}</dd>
        </div>
        {data.environment === 'sandbox' && (
          <div>
            <dt className="text-slate-600">Mode</dt>
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
            <div className="mt-1 flex flex-wrap gap-3">
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
                className={PRIMARY_BUTTON}
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
