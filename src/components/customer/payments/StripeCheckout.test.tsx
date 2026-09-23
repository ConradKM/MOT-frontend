import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

let confirmPayment = vi.fn()

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  ExpressCheckoutElement: () => null,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve({}) }))
vi.mock('../../../api/queries', () => ({ useDepositStatus: () => ({ data: undefined }) }))

import { StripeCheckout } from './StripeCheckout'

const intent = {
  booking_reference: 'BK1',
  deposit_amount: '1.00',
  provider_data: { client_secret: 'pi_secret', publishable_key: 'pk_test_example' },
} as never

describe('StripeCheckout', () => {
  it('restores a usable pay control when Stripe confirmation rejects', async () => {
    confirmPayment = vi.fn().mockRejectedValue(new Error('Elements context mismatch'))
    const user = userEvent.setup()
    render(<StripeCheckout slug="garage" intent={intent} onPaid={vi.fn()} onSlotLost={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Pay deposit/ }))

    expect(await screen.findByText(/could not start your payment/i)).toBeInTheDocument()
    expect(confirmPayment).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /Pay deposit/ })).not.toBeDisabled()
  })
})
