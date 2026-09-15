import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { useDepositStatus } from '../../../api/queries'
import type { PaymentCheckoutProps } from './types'

/** Stripe's checkout component - the only file in the codebase that imports
 * the Stripe SDK. Reads `client_secret`/`publishable_key` out of the
 * generic `provider_data` envelope (see PaymentCheckoutProps) rather than
 * assuming they exist at the top level of the deposit-intent response. */
export function StripeCheckout({ slug, intent, onPaid, onSlotLost }: PaymentCheckoutProps) {
  const clientSecret = intent.provider_data?.client_secret ?? null
  const publishableKey = intent.provider_data?.publishable_key ?? null
  const stripePromiseRef = useRef<Promise<Stripe | null> | null>(null)

  if (!clientSecret || !publishableKey) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        This business's card payment isn't set up correctly. Please contact them directly.
      </p>
    )
  }

  if (!stripePromiseRef.current) {
    stripePromiseRef.current = loadStripe(publishableKey)
  }

  return (
    <Elements stripe={stripePromiseRef.current} options={{ clientSecret }}>
      <StripePaymentForm slug={slug} intent={intent} onPaid={onPaid} onSlotLost={onSlotLost} />
    </Elements>
  )
}

type PaymentPhase = 'ready' | 'submitting' | 'confirming' | 'error'

function StripePaymentForm({ slug, intent, onPaid, onSlotLost }: PaymentCheckoutProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [phase, setPhase] = useState<PaymentPhase>('ready')
  const [error, setError] = useState<string | null>(null)

  // Poll the server's own record of what happened - never the browser's own
  // say-so - once Stripe has accepted the confirmation attempt. The webhook
  // (app/payments/service.py) is the sole authority that flips the booking
  // request from AWAITING_PAYMENT to PENDING.
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
      setPhase('error')
      setError('The payment failed. Please try again, or use a different card.')
    }
  }, [phase, poll.data, intent, onPaid, onSlotLost])

  const handlePay = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setPhase('submitting')
    setError(null)

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (confirmError) {
      setPhase('error')
      setError(confirmError.message ?? 'Payment failed. Please try again.')
      return
    }
    // Confirmed on Stripe's side - wait for our own webhook to confirm it
    // authoritatively before treating the booking as submitted.
    setPhase('confirming')
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {phase === 'confirming' && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Confirming your payment…
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || phase === 'submitting' || phase === 'confirming'}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {phase === 'submitting'
          ? 'Processing…'
          : phase === 'confirming'
            ? 'Confirming…'
            : `Pay deposit — £${intent.deposit_amount}`}
      </button>
    </form>
  )
}
