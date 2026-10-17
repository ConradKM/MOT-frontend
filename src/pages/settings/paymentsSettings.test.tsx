import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeConnectedSquareStatus, makeSquareStatus } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { PaymentsSettings } from './PaymentsSettings'

function renderSettings(route = '/g1/settings/payments') {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/payments" element={<PaymentsSettings />} />
    </Routes>,
    { route },
  )
}

function squareStatus(body: unknown, status = 200) {
  server.use(http.get('*/api/payments/square/status', () => HttpResponse.json(body, { status })))
}

function activeProvider(provider: string) {
  server.use(
    http.get('*/api/payments/provider', () =>
      HttpResponse.json({
        provider,
        options: [
          { name: 'stripe', ready: false },
          { name: 'square', ready: provider === 'square' },
        ],
      }),
    ),
  )
}

/** Both providers are always on screen, side by side. */
const card = (provider: 'stripe' | 'square') => screen.getByTestId(`payments-card-${provider}`)
const findCard = (provider: 'stripe' | 'square') => screen.findByTestId(`payments-card-${provider}`)

afterEach(() => vi.restoreAllMocks())

describe('PaymentsSettings', () => {
  it('shows Stripe and Square side by side, with Stripe active by default', async () => {
    renderSettings()
    expect(await screen.findByText('Stripe setup is incomplete')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Stripe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Square' })).toBeInTheDocument()
    expect(within(card('stripe')).getByRole('button', { name: 'Connect Stripe' })).toBeInTheDocument()
    expect(
      await within(card('stripe')).findByText('Stripe takes your online deposits.'),
    ).toBeInTheDocument()
    expect(
      within(card('square')).getByRole('button', { name: 'Use Square for online deposits' }),
    ).toBeInTheDocument()
  })

  it('shows Not connected and starts Square OAuth by redirecting to the returned URL', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    server.use(
      http.post('*/api/payments/square/connect', () =>
        HttpResponse.json({ url: 'https://connect.squareupsandbox.com/oauth2/authorize?x=1' }),
      ),
    )
    const user = userEvent.setup()
    renderSettings()

    expect(await within(await findCard('square')).findByText('Not connected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Connect Square' }))
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://connect.squareupsandbox.com/oauth2/authorize?x=1'),
    )
  })

  it('shows a connected, ready Square account with merchant and location', async () => {
    activeProvider('square')
    squareStatus(makeConnectedSquareStatus())
    const { container } = renderSettings()

    expect(await screen.findByText('Ready to take online payments')).toBeInTheDocument()
    expect(screen.getByText('Test Motors Ltd')).toBeInTheDocument()
    expect(screen.getByText('Main garage')).toBeInTheDocument()
    expect(screen.getByText('Sandbox (test payments only)')).toBeInTheDocument()
    expect(screen.getByText('Square takes your online deposits.')).toBeInTheDocument()
    expect(within(card('square')).getByText('Active')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('re-reads status on ?square=return instead of trusting the query string', async () => {
    let calls = 0
    server.use(
      http.get('*/api/payments/square/status', () => {
        calls += 1
        return HttpResponse.json(makeSquareStatus({ status: 'NOT_CONNECTED' }))
      }),
    )
    renderSettings('/g1/settings/payments?square=return&square_error=denied')
    // Lands on the Square card, shows the informational notice, but the
    // state itself is the API's ("Not connected"), not "connected".
    expect(await screen.findByText(/Square connection was cancelled/)).toBeInTheDocument()
    expect(await within(card('square')).findByText('Not connected')).toBeInTheDocument()
    expect(calls).toBeGreaterThan(0)
  })

  it('lets the owner pick among several locations', async () => {
    let sent: unknown
    squareStatus(
      makeConnectedSquareStatus({
        location_id: null,
        location_name: null,
        ready: false,
        locations: [
          { id: 'LOC_1', name: 'Main garage', currency: 'GBP', can_take_card_payments: true, eligible: true },
          { id: 'LOC_2', name: 'Second site', currency: 'GBP', can_take_card_payments: true, eligible: true },
          { id: 'LOC_US', name: 'US shop', currency: 'USD', can_take_card_payments: true, eligible: false },
        ],
      }),
    )
    server.use(
      http.put('*/api/payments/square/location', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(makeConnectedSquareStatus({ location_id: 'LOC_2', location_name: 'Second site' }))
      }),
    )
    const user = userEvent.setup()
    renderSettings()

    expect(await screen.findByText('Choose a location to finish setup')).toBeInTheDocument()
    const select = screen.getByLabelText('Location that takes deposits')
    expect(screen.queryByRole('option', { name: 'US shop' })).not.toBeInTheDocument()
    await user.selectOptions(select, 'LOC_2')
    await user.click(screen.getByRole('button', { name: 'Save location' }))
    await waitFor(() => expect(sent).toEqual({ location_id: 'LOC_2' }))
    expect(await screen.findByText('Square location saved.')).toBeInTheDocument()
  })

  it.each([
    ['REVOKED', /access to your Square account was removed/],
    ['ERROR', /can't reach your Square account/],
  ] as const)('shows Needs attention with Reconnect for %s', async (status, text) => {
    squareStatus(makeSquareStatus({ status, merchant_id: 'MLMERCHANT1' }))
    renderSettings()
    expect(await within(await findCard('square')).findByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reconnect Square' })).toBeInTheDocument()
  })

  it('disconnects after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let disconnected = false
    server.use(
      http.get('*/api/payments/square/status', () =>
        HttpResponse.json(disconnected ? makeSquareStatus() : makeConnectedSquareStatus()),
      ),
      http.post('*/api/payments/square/disconnect', () => {
        disconnected = true
        return HttpResponse.json({ disconnected: true, remote_revoke_confirmed: true })
      }),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Disconnect' }))
    expect(await screen.findByText('Square disconnected.')).toBeInTheDocument()
    expect(await within(card('square')).findByText('Not connected')).toBeInTheDocument()
  })

  it('surfaces the 409 when a payment is in progress and the owner tries to switch', async () => {
    squareStatus(makeConnectedSquareStatus())
    server.use(
      http.put('*/api/payments/provider', () =>
        HttpResponse.json(
          { code: 409, status: 'Conflict', message: 'busy', errors: { reason: 'payment_in_progress' } },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Use Square for online deposits' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "A customer is paying a deposit right now, so the provider can't be changed",
    )
  })

  it('switches the active provider', async () => {
    let sent: unknown
    server.use(
      http.put('*/api/payments/provider', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({
          provider: 'square',
          options: [
            { name: 'stripe', ready: false },
            { name: 'square', ready: true },
          ],
        })
      }),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Use Square for online deposits' }))
    await waitFor(() => expect(sent).toEqual({ provider: 'square' }))
    expect(await screen.findByText('Square takes your online deposits.')).toBeInTheDocument()
  })

  it('treats a 403 as owner-only', async () => {
    squareStatus({ code: 403, status: 'Forbidden', message: 'Owner role required.' }, 403)
    renderSettings()
    expect(
      await screen.findByText('Only the business owner can manage payment settings.'),
    ).toBeInTheDocument()
  })

  it('explains when CoMaz has not configured Square yet', async () => {
    squareStatus(makeSquareStatus({ deployment_configured: false }))
    renderSettings()
    expect(await screen.findByText(/Square isn't available on CoMaz yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect Square' })).not.toBeInTheDocument()
  })

  it.each([
    ['not connected', makeSquareStatus({ status: 'NOT_CONNECTED' }), 'stripe', 'Not connected'],
    ['connected but not active', makeConnectedSquareStatus(), 'stripe', 'Connected'],
    ['connected and active', makeConnectedSquareStatus(), 'square', 'Active'],
    [
      'connected without a location',
      makeConnectedSquareStatus({ location_id: null, location_name: null, ready: false }),
      'stripe',
      'Needs attention',
    ],
    ['revoked', makeSquareStatus({ status: 'REVOKED', merchant_id: 'M1' }), 'stripe', 'Needs attention'],
  ] as const)('badges a Square account that is %s', async (_, body, provider, badge) => {
    activeProvider(provider)
    squareStatus(body)
    renderSettings()
    expect(await within(await findCard('square')).findByText(badge)).toBeInTheDocument()
  })

  it.each([
    ['no account yet', { stripe_account_id: null, stripe_charges_enabled: false }, 'Not connected'],
    ['setup incomplete', { stripe_account_id: 'acct_1', stripe_charges_enabled: false }, 'Needs attention'],
    ['ready and active', { stripe_account_id: 'acct_1', stripe_charges_enabled: true }, 'Active'],
  ] as const)('badges a Stripe account with %s', async (_, patch, badge) => {
    server.use(
      http.get('*/api/payments/stripe/status', () =>
        HttpResponse.json({
          stripe_onboarding_complete: false,
          stripe_payouts_enabled: false,
          apple_pay_status: null,
          apple_pay_status_details: null,
          ...patch,
        }),
      ),
    )
    renderSettings()
    expect(await within(await findCard('stripe')).findByText(badge)).toBeInTheDocument()
  })
})
