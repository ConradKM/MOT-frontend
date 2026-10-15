import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Each mock factory runs only if (and when) its module is actually imported,
// so these flags prove which checkout code was loaded - the same lazy-load
// guarantee StripeCheckout relies on (#122).
const loaded = vi.hoisted(() => ({ stripe: false, square: false }))

vi.mock('./StripeCheckout', () => {
  loaded.stripe = true
  return { StripeCheckout: () => <div data-testid="stripe-checkout" /> }
})
vi.mock('./SquareCheckout', () => {
  loaded.square = true
  return { SquareCheckout: () => <div data-testid="square-checkout" /> }
})

import { PaymentCheckout } from './PaymentCheckout'

function renderFor(provider: string, checkoutMode = 'EMBEDDED') {
  return render(
    <PaymentCheckout
      slug="garage"
      intent={{ provider, checkout_mode: checkoutMode, provider_data: {} } as never}
      onPaid={vi.fn()}
      onSlotLost={vi.fn()}
    />,
  )
}

describe('PaymentCheckout', () => {
  it('does not load any provider checkout code until one is rendered', () => {
    renderFor('paypal', 'REDIRECT')
    expect(
      screen.getByText(/payment method isn't available online right now/),
    ).toBeInTheDocument()
    expect(loaded).toEqual({ stripe: false, square: false })
  })

  it('renders Stripe without loading Square', async () => {
    renderFor('stripe')
    expect(await screen.findByTestId('stripe-checkout')).toBeInTheDocument()
    expect(loaded.square).toBe(false)
    expect(document.querySelector('script[data-square-sdk]')).toBeNull()
  })

  it('renders SquareCheckout for square + EMBEDDED', async () => {
    renderFor('square')
    expect(await screen.findByTestId('square-checkout')).toBeInTheDocument()
    expect(loaded.square).toBe(true)
  })

  it('shows the fallback for square in an unsupported mode or an unknown provider', () => {
    renderFor('square', 'REDIRECT')
    expect(screen.getByText(/isn't available online right now/)).toBeInTheDocument()
  })
})
