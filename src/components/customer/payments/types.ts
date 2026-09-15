import type { DepositIntentCreated } from '../../../api/publicGarage'

/** What every provider-specific checkout component (StripeCheckout.tsx, and
 * any future PayPalCheckout.tsx/SquareCheckout.tsx) receives - the common
 * Deposit UI (src/components/customer/DepositStep.tsx) owns everything
 * else (summary, branding, retry/error chrome around this). A checkout
 * component's only job is the actual secure payment interaction and
 * reporting back success/failure/expiry through these callbacks. */
export interface PaymentCheckoutProps {
  slug: string
  /** The just-created deposit session - always has `provider_data`
   * populated (only true right after creation, never on a re-render from
   * a status poll). */
  intent: DepositIntentCreated
  /** Called once the backend's own webhook has confirmed the deposit
   * succeeded (never called just because the provider's own SDK reported
   * success client-side). */
  onPaid: (result: DepositIntentCreated) => void
  /** Called when the payment hold expired before payment completed - the
   * slot is gone; the wizard should send the customer back to pick a new
   * one. */
  onSlotLost: () => void
}
