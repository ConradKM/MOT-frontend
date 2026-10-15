import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '../../../api/client'
import type { SquareGlobal, SquareTokenResult } from './squareSdk'

let pollData: unknown = undefined
const pollOptions: Array<{ enabled?: boolean }> = []
vi.mock('../../../api/queries', () => ({
  useDepositStatus: (_slug: string, _ref: string, options: { enabled?: boolean }) => {
    pollOptions.push(options)
    return { data: options.enabled ? pollData : undefined }
  },
}))

const submitDepositToken = vi.fn()
vi.mock('../../../api/publicGarage', () => ({
  submitDepositToken: (...args: unknown[]) => submitDepositToken(...args),
}))

const loadSquareSdk = vi.fn()
vi.mock('./squareSdk', () => ({ loadSquareSdk: (...args: unknown[]) => loadSquareSdk(...args) }))

import { SquareCheckout } from './SquareCheckout'

const intent = {
  booking_reference: 'BK1',
  status: 'AWAITING_PAYMENT',
  payment_status: 'REQUIRES_PAYMENT',
  deposit_amount: '20.00',
  currency: 'GBP',
  provider: 'square',
  checkout_mode: 'EMBEDDED',
  provider_data: {
    application_id: 'sandbox-sq0idb-app',
    location_id: 'LOC_1',
    environment: 'sandbox',
    amount: '20.00',
    amount_minor: 2000,
    currency: 'GBP',
  },
} as never

let tokenize = vi.fn<(details?: unknown) => Promise<SquareTokenResult>>()
let attach = vi.fn()
let destroy = vi.fn()
let paymentsFactory = vi.fn()

function stubSdk() {
  const square: SquareGlobal = {
    payments: (...args: [string, string]) => {
      paymentsFactory(...args)
      return { card: async () => ({ attach, tokenize, destroy }) }
    },
  }
  loadSquareSdk.mockResolvedValue(square)
}

beforeEach(() => {
  pollData = undefined
  pollOptions.length = 0
  tokenize = vi.fn().mockResolvedValue({ status: 'OK', token: 'cnon:card-ok' })
  attach = vi.fn().mockResolvedValue(undefined)
  destroy = vi.fn().mockResolvedValue(true)
  paymentsFactory = vi.fn()
  submitDepositToken.mockReset().mockResolvedValue({ status: 'AWAITING_PAYMENT', payment_status: 'PENDING' })
  loadSquareSdk.mockReset()
  stubSdk()
})

afterEach(() => vi.clearAllMocks())

function renderCheckout(overrides: Partial<{ onPaid: () => void; onSlotLost: () => void; intent: unknown }> = {}) {
  const onPaid = overrides.onPaid ?? vi.fn()
  const onSlotLost = overrides.onSlotLost ?? vi.fn()
  const view = render(
    <SquareCheckout
      slug="garage"
      intent={(overrides.intent ?? intent) as never}
      onPaid={onPaid}
      onSlotLost={onSlotLost}
    />,
  )
  return { ...view, onPaid, onSlotLost }
}

async function ready() {
  const button = await screen.findByRole('button', { name: 'Pay deposit — £20.00' })
  await waitFor(() => expect(button).not.toBeDisabled())
  return button
}

describe('SquareCheckout', () => {
  it('loads the SDK for the right environment and mounts the card with client-safe ids', async () => {
    renderCheckout()
    await ready()
    expect(loadSquareSdk).toHaveBeenCalledWith('sandbox')
    expect(paymentsFactory).toHaveBeenCalledWith('sandbox-sq0idb-app', 'LOC_1')
    expect(attach).toHaveBeenCalledWith(screen.getByTestId('square-card-container'))
  })

  it('tokenises with SCA verification details, submits the token, then waits for the webhook', async () => {
    const user = userEvent.setup()
    const { onPaid, rerender } = renderCheckout()
    await user.click(await ready())

    expect(tokenize).toHaveBeenCalledWith({
      amount: '20.00',
      currencyCode: 'GBP',
      intent: 'CHARGE',
      billingContact: { countryCode: 'GB' },
      customerInitiated: true,
      sellerKeyedIn: false,
    })
    expect(submitDepositToken).toHaveBeenCalledWith('garage', 'BK1', { source_id: 'cnon:card-ok' })
    expect(await screen.findByText('Confirming your payment…')).toBeInTheDocument()
    expect(onPaid).not.toHaveBeenCalled() // the SDK/charge response is never proof of payment

    pollData = { status: 'PENDING', payment_status: 'SUCCEEDED', booking_reference: 'BK1' }
    rerender(<SquareCheckout slug="garage" intent={intent} onPaid={onPaid} onSlotLost={vi.fn()} />)
    await waitFor(() => expect(onPaid).toHaveBeenCalledOnce())
    expect(onPaid).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', provider: null, provider_data: null }),
    )
  })

  it('shows a card error from tokenize and lets the customer retry', async () => {
    tokenize.mockResolvedValueOnce({ status: 'Invalid', errors: [{ message: 'Card number is not valid' }] })
    const user = userEvent.setup()
    renderCheckout()
    await user.click(await ready())
    expect(await screen.findByText('Card number is not valid')).toBeInTheDocument()
    expect(submitDepositToken).not.toHaveBeenCalled()
    await user.click(await ready())
    expect(submitDepositToken).toHaveBeenCalledOnce()
  })

  it('shows a decline from the backend and keeps the form usable', async () => {
    submitDepositToken.mockRejectedValueOnce(
      new ApiError(
        { code: 400, status: 'Bad Request', message: 'Your card was declined.', errors: { reason: 'payment_failed' } },
        'fail',
      ),
    )
    const user = userEvent.setup()
    renderCheckout()
    await user.click(await ready())
    expect(
      await screen.findByText('Your card was declined. Please try again, or use a different card.'),
    ).toBeInTheDocument()
    expect(await ready()).not.toBeDisabled()
  })

  it('reports a failed payment reported by the poll', async () => {
    const user = userEvent.setup()
    const { rerender } = renderCheckout()
    await user.click(await ready())
    await screen.findByText('Confirming your payment…')
    pollData = { status: 'AWAITING_PAYMENT', payment_status: 'FAILED' }
    rerender(<SquareCheckout slug="garage" intent={intent} onPaid={vi.fn()} onSlotLost={vi.fn()} />)
    expect(await screen.findByText(/The payment failed/)).toBeInTheDocument()
  })

  it('sends the customer back to pick a slot when the hold expired', async () => {
    submitDepositToken.mockRejectedValueOnce(
      new ApiError(
        { code: 409, status: 'Conflict', message: 'expired', errors: { reason: 'hold_expired' } },
        'fail',
      ),
    )
    const user = userEvent.setup()
    const { onSlotLost } = renderCheckout()
    await user.click(await ready())
    await waitFor(() => expect(onSlotLost).toHaveBeenCalledOnce())
  })

  it('reports slot lost when the poll says EXPIRED', async () => {
    const user = userEvent.setup()
    const onSlotLost = vi.fn()
    const { rerender } = renderCheckout({ onSlotLost })
    await user.click(await ready())
    await screen.findByText('Confirming your payment…')
    pollData = { status: 'EXPIRED', payment_status: 'CANCELLED' }
    rerender(<SquareCheckout slug="garage" intent={intent} onPaid={vi.fn()} onSlotLost={onSlotLost} />)
    await waitFor(() => expect(onSlotLost).toHaveBeenCalledOnce())
  })

  it('guards against a double submit', async () => {
    let finish: (value: SquareTokenResult) => void = () => {}
    tokenize.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    renderCheckout()
    const button = await ready()
    await user.click(button)
    expect(screen.getByRole('button', { name: 'Processing…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Processing…' }))
    await act(async () => finish({ status: 'OK', token: 'cnon:once' }))
    await screen.findByText('Confirming your payment…')
    expect(tokenize).toHaveBeenCalledOnce()
    expect(submitDepositToken).toHaveBeenCalledOnce()
  })

  it('handles the SDK failing to load with a clear message and a retry', async () => {
    loadSquareSdk.mockRejectedValueOnce(new Error('blocked'))
    const user = userEvent.setup()
    renderCheckout()
    expect(await screen.findByText(/couldn't load Square's secure card form/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await ready()).toBeInTheDocument()
    expect(loadSquareSdk).toHaveBeenCalledTimes(2)
  })

  it('goes straight to confirming for a recovered attempt that was already submitted', async () => {
    renderCheckout({ intent: { ...(intent as object), payment_status: 'PENDING' } })
    expect(await screen.findByText('Confirming your payment…')).toBeInTheDocument()
    expect(loadSquareSdk).not.toHaveBeenCalled()
    expect(pollOptions.at(-1)).toEqual({ enabled: true })
  })

  it('refuses to render with incomplete provider data', () => {
    renderCheckout({ intent: { ...(intent as object), provider_data: { environment: 'sandbox' } } })
    expect(screen.getByText(/isn't set up correctly/)).toBeInTheDocument()
    expect(loadSquareSdk).not.toHaveBeenCalled()
  })

  it('destroys the card field on unmount', async () => {
    const { unmount } = renderCheckout()
    await ready()
    unmount()
    expect(destroy).toHaveBeenCalled()
  })
})
