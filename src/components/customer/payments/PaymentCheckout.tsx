import { lazy, Suspense } from 'react'
import type { PaymentCheckoutProps } from './types'

// Split out so @stripe/react-stripe-js + the Stripe loader only download when
// a deposit is actually due, not with every visit to the booking wizard.
const StripeCheckout = lazy(() =>
  import('./StripeCheckout').then((m) => ({ default: m.StripeCheckout })),
)

/** Picks the right provider-specific checkout component for this deposit
 * session - the only place in the wizard that branches on `provider`/
 * `checkout_mode`. Adding a new provider (see docs/PAYMENTS_PROVIDERS.md)
 * means adding one more branch here and a new component alongside
 * StripeCheckout.tsx; DepositStep.tsx (the common summary/branding/error
 * chrome around this) never changes. */
export function PaymentCheckout(props: PaymentCheckoutProps) {
  const { provider, checkout_mode: checkoutMode } = props.intent

  if (provider === 'stripe' && checkoutMode === 'EMBEDDED') {
    return (
      <Suspense fallback={<p className="text-sm text-slate-500">Loading secure checkout…</p>}>
        <StripeCheckout {...props} />
      </Suspense>
    )
  }

  // A provider this build of the frontend doesn't have a component for yet
  // (e.g. a business configured for PayPal/Square before those adapters are
  // real) - a clear message, never a blank screen or a silent failure.
  return (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
      This business's payment method isn't available online right now. Please contact them
      directly to book.
    </p>
  )
}
