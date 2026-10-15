/** Guarded, idempotent loader for Square's Web Payments SDK script.
 *
 * Square ships the SDK only as a hosted script (no npm runtime package), with
 * different hosts for sandbox and production. It is injected the first time a
 * Square checkout actually mounts - never at import time - so nothing from
 * Square loads on a booking that doesn't need a Square deposit (the same rule
 * as StripeCheckout's `@stripe/stripe-js/pure` import).
 *
 * Only the handful of SDK members SquareCheckout uses are typed here. */

export const SQUARE_SDK_URLS = {
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
  production: 'https://web.squarecdn.com/v1/square.js',
} as const

export type SquareEnvironment = keyof typeof SQUARE_SDK_URLS

export interface SquareTokenError {
  message?: string
}

export interface SquareTokenResult {
  status: string // 'OK' | 'Cancel' | 'Error' | ...
  token?: string
  errors?: SquareTokenError[]
}

export interface SquareVerificationDetails {
  amount: string
  currencyCode: string
  intent: 'CHARGE'
  billingContact: Record<string, unknown>
  customerInitiated: boolean
  sellerKeyedIn: boolean
}

export interface SquareCard {
  attach(target: string | HTMLElement): Promise<void>
  /** With verificationDetails, Square runs Strong Customer Authentication
   * (3DS) as part of tokenising - the current replacement for the
   * deprecated payments.verifyBuyer(). */
  tokenize(verificationDetails?: SquareVerificationDetails): Promise<SquareTokenResult>
  destroy(): Promise<boolean>
}

export interface SquarePayments {
  card(options?: Record<string, unknown>): Promise<SquareCard>
}

export interface SquareGlobal {
  payments(applicationId: string, locationId: string): SquarePayments
}

declare global {
  interface Window {
    Square?: SquareGlobal
  }
}

const pending = new Map<string, Promise<SquareGlobal>>()

export function loadSquareSdk(environment: SquareEnvironment): Promise<SquareGlobal> {
  const src = SQUARE_SDK_URLS[environment]
  if (window.Square) return Promise.resolve(window.Square)
  const existing = pending.get(src)
  if (existing) return existing

  const promise = new Promise<SquareGlobal>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.dataset.squareSdk = environment
    script.onload = () => {
      if (window.Square) resolve(window.Square)
      else reject(new Error('Square SDK loaded without defining window.Square'))
    }
    script.onerror = () => reject(new Error('Square SDK failed to load'))
    document.head.appendChild(script)
  }).catch((err: unknown) => {
    // Allow a later mount (e.g. "Try again") to retry from scratch.
    pending.delete(src)
    document.querySelector(`script[src="${src}"]`)?.remove()
    throw err
  })
  pending.set(src, promise)
  return promise
}

/** Test-only: forget any cached load. */
export function resetSquareSdkLoader() {
  pending.clear()
}
