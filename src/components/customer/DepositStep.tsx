import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import {
  createDepositIntent,
  type BookingRequestInput,
  type DepositIntentCreated,
  type PublicAppointmentType,
} from '../../api/publicGarage'
import { useDepositStatus } from '../../api/queries'
import { errorMessage, isApiError } from '../../lib/errors'

interface Props {
  slug: string
  garageName: string
  payload: BookingRequestInput
  appointmentType: PublicAppointmentType | undefined
  onPaid: (result: DepositIntentCreated) => void
  onSlotLost: () => void
}

/** The Deposit step: creates a short-lived payment hold + provider intent
 * the moment this step is entered, then renders Stripe's Payment Element
 * against it. Only ever mounted when the selected service requires a
 * deposit (see BookingWizard.tsx) - a plain booking never touches this. */
export function DepositStep({ slug, garageName, payload, appointmentType, onPaid, onSlotLost }: Props) {
  const [intent, setIntent] = useState<DepositIntentCreated | null>(null)
  const [creating, setCreating] = useState(true)
  const [createError, setCreateError] = useState<string | null>(null)
  const stripePromiseRef = useRef<Promise<Stripe | null> | null>(null)

  useEffect(() => {
    let cancelled = false
    setCreating(true)
    setCreateError(null)
    createDepositIntent(slug, payload)
      .then((result) => {
        if (cancelled) return
        setIntent(result)
        setCreating(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (isApiError(err) && err.code === 409) {
          setCreateError('This time is no longer available. Please go back and choose another.')
        } else if (isApiError(err) && err.code === 503) {
          setCreateError(
            "This business isn't able to take deposit payments online right now. Please contact them directly to book.",
          )
        } else {
          setCreateError(errorMessage(err))
        }
        setCreating(false)
      })
    return () => {
      cancelled = true
    }
    // Deliberately only on mount/slug change - the payload is captured once
    // when this step is entered from Details, not re-triggered on every
    // keystroke (there's no path back into this step without re-entering it
    // via Details, which remounts this component fresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (creating) {
    return <div className="py-12 text-center text-sm text-slate-500">Setting up your payment…</div>
  }

  if (createError || !intent?.client_secret || !intent.publishable_key) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Deposit</h2>
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {createError ?? "This business isn't able to take deposit payments online right now."}
        </p>
      </div>
    )
  }

  if (!stripePromiseRef.current) {
    stripePromiseRef.current = loadStripe(intent.publishable_key)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Deposit</h2>
      <p className="mt-1 text-sm text-slate-500">
        This service needs a deposit before your booking is sent for review.
      </p>

      <DepositSummary intent={intent} appointmentType={appointmentType} garageName={garageName} />

      <div className="mt-4">
        <Elements stripe={stripePromiseRef.current} options={{ clientSecret: intent.client_secret }}>
          <DepositPaymentForm slug={slug} intent={intent} onPaid={onPaid} onSlotLost={onSlotLost} />
        </Elements>
      </div>
    </div>
  )
}

function DepositSummary({
  intent,
  appointmentType,
  garageName,
}: {
  intent: DepositIntentCreated
  appointmentType: PublicAppointmentType | undefined
  garageName: string
}) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
      {appointmentType && <p className="font-medium text-slate-900">{appointmentType.name}</p>}
      <dl className="mt-2 space-y-1">
        {intent.service_total && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Service total</dt>
            <dd className="text-slate-800">£{intent.service_total}</dd>
          </div>
        )}
        <div className="flex justify-between font-medium">
          <dt className="text-slate-700">Deposit due now</dt>
          <dd className="text-slate-900">£{intent.deposit_amount}</dd>
        </div>
        {intent.remaining_balance && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Balance due later</dt>
            <dd className="text-slate-600">£{intent.remaining_balance}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        Paying this deposit secures your requested slot and submits your booking to {garageName} for
        review.
      </p>
    </div>
  )
}

type PaymentPhase = 'ready' | 'submitting' | 'confirming' | 'error'

function DepositPaymentForm({
  slug,
  intent,
  onPaid,
  onSlotLost,
}: {
  slug: string
  intent: DepositIntentCreated
  onPaid: (result: DepositIntentCreated) => void
  onSlotLost: () => void
}) {
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
      onPaid({
        ...intent,
        ...poll.data,
        client_secret: null,
        publishable_key: null,
        provider: null,
      })
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
