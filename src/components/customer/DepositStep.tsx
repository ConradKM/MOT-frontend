import { useEffect, useState } from 'react'
import {
  createDepositIntent,
  type BookingRequestInput,
  type DepositIntentCreated,
  type PublicAppointmentType,
} from '../../api/publicGarage'
import { errorMessage, isApiError } from '../../lib/errors'
import { PaymentCheckout } from './payments/PaymentCheckout'

interface Props {
  slug: string
  garageName: string
  payload: BookingRequestInput
  appointmentType: PublicAppointmentType | undefined
  onPaid: (result: DepositIntentCreated) => void
  onSlotLost: () => void
  initialIntent?: DepositIntentCreated | null
  onRecoveryToken: (token: string) => void
}

/** The Deposit step: creates a short-lived payment hold + provider session
 * the moment this step is entered, then renders whichever checkout
 * component matches the session's provider/checkout mode (see
 * src/components/customer/payments/PaymentCheckout.tsx). Only ever mounted
 * when the selected service requires a deposit (see BookingWizard.tsx) - a
 * plain booking never touches this, and everything here - summary,
 * branding, error/retry chrome - is completely provider-independent; only
 * PaymentCheckout's child component ever talks to a specific provider.
 */
export function DepositStep({
  slug, garageName, payload, appointmentType, onPaid, onSlotLost, initialIntent, onRecoveryToken,
}: Props) {
  const [intent, setIntent] = useState<DepositIntentCreated | null>(initialIntent ?? null)
  const [creating, setCreating] = useState(!initialIntent)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (initialIntent) {
      setIntent(initialIntent)
      setCreating(false)
      return
    }
    let cancelled = false
    setCreating(true)
    setCreateError(null)
    createDepositIntent(slug, payload)
      .then((result) => {
        if (cancelled) return
        setIntent(result)
        if (result.recovery_token) onRecoveryToken(result.recovery_token)
        setCreating(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // A 409 with this specific reason (see app/booking_requests/service.py::
        // resolve_customer_and_vehicle) has nothing to do with the slot - a
        // different customer already owns a vehicle with this registration at
        // this garage - so it must not be shown as "slot unavailable".
        if (isApiError(err) && err.code === 409 && err.reason === 'vehicle_reference_conflict') {
          setCreateError(
            'That vehicle registration is already registered under a different profile ' +
              'with this business. Please double-check what you entered, or contact them ' +
              'directly if you believe this is a mistake.',
          )
        } else if (isApiError(err) && err.code === 409) {
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
  }, [slug, initialIntent, onRecoveryToken])

  if (creating) {
    return <div className="py-12 text-center text-sm text-slate-500">Setting up your payment…</div>
  }

  if (createError || !intent?.provider_data) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Deposit</h2>
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {createError ?? "This business isn't able to take deposit payments online right now."}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Deposit</h2>
      <p className="mt-1 text-sm text-slate-500">
        This service needs a deposit before your booking is sent for review.
      </p>

      <DepositSummary intent={intent} appointmentType={appointmentType} garageName={garageName} />

      <div className="mt-4">
        <PaymentCheckout slug={slug} intent={intent} onPaid={onPaid} onSlotLost={onSlotLost} />
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
