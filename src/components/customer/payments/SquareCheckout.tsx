import { useEffect, useRef, useState, type FormEvent } from 'react'
import { submitDepositToken } from '../../../api/publicGarage'
import { useDepositStatus } from '../../../api/queries'
import { isApiError } from '../../../lib/errors'
import { loadSquareSdk, type SquareCard, type SquareEnvironment } from './squareSdk'
import type { PaymentCheckoutProps } from './types'

type PaymentPhase = 'loading' | 'ready' | 'submitting' | 'confirming' | 'error' | 'unavailable'

/** Square's checkout component - the only file that talks to Square's Web
 * Payments SDK. Square is a two-phase provider: the browser tokenises the
 * card (running Strong Customer Authentication as part of tokenize()), then
 * our backend charges that single-use token on the business's own Square
 * account. Exactly as with StripeCheckout, a deposit only counts as paid
 * once the status poll reports the backend's webhook-confirmed outcome.
 *
 * Reads only client-safe values (application id, location id, environment,
 * amount) from the generic `provider_data` envelope. */
export function SquareCheckout({ slug, intent, onPaid, onSlotLost }: PaymentCheckoutProps) {
  const data = intent.provider_data ?? {}
  const applicationId = typeof data.application_id === 'string' ? data.application_id : null
  const locationId = typeof data.location_id === 'string' ? data.location_id : null
  const environment: SquareEnvironment =
    data.environment === 'production' ? 'production' : 'sandbox'
  const amount =
    typeof data.amount === 'string' ? data.amount : (intent.deposit_amount ?? '0.00')
  const currency = typeof data.currency === 'string' ? data.currency : (intent.currency ?? 'GBP')
  // A recovered attempt whose card was already submitted: nothing to
  // re-enter, just wait for the confirmation.
  const alreadySubmitted = intent.payment_status === 'PENDING'

  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<SquareCard | null>(null)
  const [phase, setPhase] = useState<PaymentPhase>(alreadySubmitted ? 'confirming' : 'loading')
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  const poll = useDepositStatus(slug, intent.booking_reference ?? undefined, {
    enabled: phase === 'confirming',
  })

  useEffect(() => {
    if (phase !== 'confirming' || !poll.data) return
    if (poll.data.status === 'PENDING') {
      onPaid({ ...intent, ...poll.data, provider: null, checkout_mode: null, provider_data: null })
    } else if (poll.data.status === 'EXPIRED') {
      onSlotLost()
    } else if (poll.data.payment_status === 'FAILED') {
      setPhase(cardRef.current ? 'ready' : 'error')
      setError('The payment failed. Please try again, or use a different card.')
    }
  }, [phase, poll.data, intent, onPaid, onSlotLost])

  // Load the SDK and mount the card field - only once this component is
  // actually on screen, and never for an attempt that's already submitted.
  useEffect(() => {
    if (alreadySubmitted || !applicationId || !locationId) return
    let cancelled = false
    let card: SquareCard | null = null
    loadSquareSdk(environment)
      .then(async (square) => {
        if (cancelled) return
        card = await square.payments(applicationId, locationId).card()
        if (cancelled || !containerRef.current) {
          void card.destroy()
          return
        }
        await card.attach(containerRef.current)
        if (cancelled) {
          void card.destroy()
          return
        }
        cardRef.current = card
        setPhase('ready')
      })
      .catch(() => {
        if (cancelled) return
        setPhase('unavailable')
        setError(
          "We couldn't load Square's secure card form. Check your connection and try again.",
        )
      })
    return () => {
      cancelled = true
      cardRef.current = null
      if (card) void card.destroy()
    }
  }, [alreadySubmitted, applicationId, locationId, environment, loadAttempt])

  if (!applicationId || !locationId) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        This business's card payment isn't set up correctly. Please contact them directly.
      </p>
    )
  }

  const handlePay = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const card = cardRef.current
    // The button is disabled outside 'ready'; this also guards a fast
    // double-click landing before the re-render.
    if (!card || phase !== 'ready' || !intent.booking_reference) return
    setPhase('submitting')
    setError(null)

    let token: string | undefined
    try {
      const result = await card.tokenize({
        amount,
        currencyCode: currency,
        intent: 'CHARGE',
        billingContact: { countryCode: 'GB' },
        customerInitiated: true,
        sellerKeyedIn: false,
      })
      if (result.status !== 'OK' || !result.token) {
        setPhase('ready')
        setError(
          result.errors?.[0]?.message ?? 'Please check your card details and try again.',
        )
        return
      }
      token = result.token
    } catch {
      setPhase('ready')
      setError('We could not verify your card. Please check your details and try again.')
      return
    }

    try {
      await submitDepositToken(slug, intent.booking_reference, { source_id: token })
    } catch (err) {
      if (isApiError(err) && err.code === 409 && err.reason === 'hold_expired') {
        onSlotLost()
        return
      }
      setPhase('ready')
      setError(
        isApiError(err) && err.reason === 'payment_failed' && err.message
          ? `${err.message} Please try again, or use a different card.`
          : 'We could not take your payment. Please try again.',
      )
      return
    }
    // Submitted to Square - wait for our own webhook-confirmed status.
    setPhase('confirming')
  }

  const busy = phase === 'submitting' || phase === 'confirming'
  return (
    <form onSubmit={handlePay} className="space-y-4">
      {!alreadySubmitted && (
        <div
          ref={containerRef}
          data-testid="square-card-container"
          className={phase === 'unavailable' ? 'hidden' : 'min-h-[88px]'}
        />
      )}
      {phase === 'loading' && (
        <p className="text-sm text-slate-500">Loading secure checkout…</p>
      )}

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {phase === 'confirming' && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Confirming your payment…
        </p>
      )}

      {phase === 'unavailable' ? (
        <button
          type="button"
          onClick={() => {
            setPhase('loading')
            setError(null)
            setLoadAttempt((n) => n + 1)
          }}
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Try again
        </button>
      ) : (
        <button
          type="submit"
          disabled={phase !== 'ready'}
          aria-busy={busy}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {phase === 'submitting'
            ? 'Processing…'
            : phase === 'confirming'
              ? 'Confirming…'
              : `Pay deposit — £${intent.deposit_amount}`}
        </button>
      )}
    </form>
  )
}
