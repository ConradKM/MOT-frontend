import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../test/msw/server'
import { makeLoyaltyLedgerEntry, makeLoyaltyProgress, makeLoyaltyReward } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { LoyaltyCard } from './LoyaltyCard'

function renderCard() {
  signInAsStaff()
  return renderWithAppProviders(<LoyaltyCard customerId="c1" />)
}

describe('LoyaltyCard', () => {
  it('renders nothing when loyalty is disabled for the business', async () => {
    let requested = false
    server.use(
      http.get('*/api/loyalty/customers/:id/progress', () => {
        requested = true
        return HttpResponse.json(makeLoyaltyProgress({ enabled: false }))
      }),
    )
    renderCard()
    // No "loading finished" text ever appears for a component whose success
    // case is rendering nothing - wait for the request itself to land, then
    // let React flush before asserting nothing rendered.
    await waitFor(() => expect(requested).toBe(true))
    await waitFor(() => expect(screen.queryByText('Loyalty')).not.toBeInTheDocument())
  })

  it('renders nothing when loyalty is not configured for the business', async () => {
    let requested = false
    server.use(
      http.get('*/api/loyalty/customers/:id/progress', () => {
        requested = true
        return HttpResponse.json({ code: 404, status: 'Not Found' }, { status: 404 })
      }),
    )
    renderCard()
    await waitFor(() => expect(requested).toBe(true))
    await waitFor(() => expect(screen.queryByText('Loyalty')).not.toBeInTheDocument())
  })

  it('shows progress toward the next reward', async () => {
    server.use(
      http.get('*/api/loyalty/customers/:id/progress', () =>
        HttpResponse.json(
          makeLoyaltyProgress({ current_units: 3, target: 5, reward_available: false }),
        ),
      ),
    )
    renderCard()
    expect(await screen.findByText('3 / 5 visits')).toBeInTheDocument()
    expect(screen.getByText('2 more visits until £10.00 off.')).toBeInTheDocument()
  })

  it('offers a one-tap redeem when a reward is available', async () => {
    server.use(
      http.get('*/api/loyalty/customers/:id/progress', () =>
        HttpResponse.json(
          makeLoyaltyProgress({
            current_units: 0,
            reward_available: true,
            available_rewards: [makeLoyaltyReward()],
          }),
        ),
      ),
    )
    let redeemed = false
    server.use(
      http.post('*/api/loyalty/customers/:id/rewards/:rewardId/redeem', () => {
        redeemed = true
        return HttpResponse.json(makeLoyaltyReward({ status: 'REDEEMED' }))
      }),
    )
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderCard()

    expect(await screen.findByText('Reward available — £10.00 off')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Redeem' }))

    await waitFor(() => expect(redeemed).toBe(true))
    confirmSpy.mockRestore()
  })

  it('does not redeem when the confirmation is declined', async () => {
    server.use(
      http.get('*/api/loyalty/customers/:id/progress', () =>
        HttpResponse.json(
          makeLoyaltyProgress({ reward_available: true, available_rewards: [makeLoyaltyReward()] }),
        ),
      ),
    )
    let redeemed = false
    server.use(
      http.post('*/api/loyalty/customers/:id/rewards/:rewardId/redeem', () => {
        redeemed = true
        return HttpResponse.json(makeLoyaltyReward({ status: 'REDEEMED' }))
      }),
    )
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderCard()

    await user.click(await screen.findByRole('button', { name: 'Redeem' }))
    expect(redeemed).toBe(false)
    confirmSpy.mockRestore()
  })

  it('shows ledger history when expanded', async () => {
    server.use(
      http.get('*/api/loyalty/customers/:id/history', () =>
        HttpResponse.json([makeLoyaltyLedgerEntry({ reason: null })]),
      ),
    )
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole('button', { name: 'Show history' }))
    expect(await screen.findByText('Visit earned')).toBeInTheDocument()
  })
})
