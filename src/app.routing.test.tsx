import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from './test/msw/server'
import { makeGarage } from './test/fixtures'
import { renderWithAppProviders, signInAsCustomer, signInAsStaff } from './test/utils'
import App from './App'
import { getAccessToken } from './api/tokens'

/**
 * Routing + auth-guard behaviour of the real <App/> route tree, rendered in the
 * same provider stack main.tsx uses, with the API mocked at the network layer.
 */
const renderApp = (route: string) => renderWithAppProviders(<App />, { route })

describe('public routes', () => {
  it('sends the bare root to the booking entry point', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: /booking link needed/i })).toBeInTheDocument()
  })

  it('asks for a garage-specific link when /book is opened without one', async () => {
    // There is deliberately no garage picker — a booking always starts from
    // the garage's own link.
    renderApp('/book')
    expect(await screen.findByText(/use your business's booking link/i)).toBeInTheDocument()
  })

  it('opens the wizard for a garage-specific booking link', async () => {
    renderApp('/book/g1')
    expect(await screen.findByRole('heading', { name: 'Bennett Motors' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /pick a date & time/i })).toBeInTheDocument()
  })

  it('says the garage could not be found for a dead booking link', async () => {
    server.use(
      http.get('*/api/public/garages/:id', () =>
        HttpResponse.json({ code: 404, status: 'x' }, { status: 404 }),
      ),
    )
    renderApp('/book/nope')
    expect(await screen.findByRole('heading', { name: /business not found/i })).toBeInTheDocument()
  })

  it('falls back to booking for an unknown URL rather than showing a dead end', async () => {
    renderApp('/this/route/does/not/exist')
    expect(await screen.findByRole('heading', { name: /booking link needed/i })).toBeInTheDocument()
  })

  it('reaches the staff sign-in page', async () => {
    renderApp('/login')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('offers one sign-in button from the public shell', async () => {
    renderApp('/book/g1')
    expect(await screen.findByRole('link', { name: 'Sign In' })).toHaveAttribute(
      'href',
      '/customer/login',
    )
  })
})

describe('staff protected routes', () => {
  it('redirects a signed-out visitor to sign in', async () => {
    renderApp('/g1/customers')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it.each(['/dashboard', '/g1/appointments', '/g1/settings', '/g1/booking-requests'])(
    'guards %s behind sign-in',
    async (route) => {
      renderApp(route)
      expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    },
  )

  it('lets a signed-in employee reach a protected page', async () => {
    signInAsStaff()
    renderApp('/g1/customers')
    expect(await screen.findByRole('heading', { name: 'Customers' })).toBeInTheDocument()
  })

  it('resolves /dashboard to the employee’s own garage', async () => {
    // Login and the nav can target a fixed path without knowing the garage id.
    server.use(http.get('*/api/garage', () => HttpResponse.json(makeGarage({ id: 'g-real' }))))
    signInAsStaff()
    renderApp('/dashboard')
    expect(await screen.findByText("Here's what's going on today.")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute(
        'href',
        '/g-real/customers',
      ),
    )
  })

  it('lands a bare garage URL on that garage’s dashboard', async () => {
    signInAsStaff()
    renderApp('/g1')
    expect(await screen.findByText("Here's what's going on today.")).toBeInTheDocument()
  })
})

describe('customer portal routes', () => {
  it('redirects a signed-out visitor away from the account hub', async () => {
    renderApp('/customer/account')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('guards an individual appointment page too', async () => {
    renderApp('/customer/appointments/a1')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('lets a signed-in customer reach their account hub', async () => {
    server.use(
      http.get('*/api/customer/account', () =>
        HttpResponse.json({
          customer: { first_name: 'Oliver', garage_name: 'Bennett Motors' },
          vehicles: [],
          appointments: [],
        }),
      ),
    )
    signInAsCustomer()
    renderApp('/customer/account')
    expect(await screen.findByRole('heading', { name: 'Hi Oliver' })).toBeInTheDocument()
  })

  it('does not let a staff session unlock the customer portal', async () => {
    // The two sessions are independent; one must never stand in for the other.
    signInAsStaff()
    renderApp('/customer/account')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('does not let a customer session unlock the staff app', async () => {
    signInAsCustomer()
    renderApp('/g1/customers')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('navigating between pages', () => {
  it('moves from the dashboard to customers through the nav', async () => {
    signInAsStaff()
    const user = userEvent.setup()
    renderApp('/g1/dashboard')
    await screen.findByText("Here's what's going on today.")

    await user.click(screen.getByRole('link', { name: 'Customers' }))
    expect(await screen.findByRole('heading', { name: 'Customers' })).toBeInTheDocument()
  })

  it('returns the user to sign-in after logging out', async () => {
    signInAsStaff()
    const user = userEvent.setup()
    renderApp('/g1/dashboard')
    await screen.findByText("Here's what's going on today.")

    await user.click(screen.getByRole('button', { name: /log out/i }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })

  it('drops the user back to sign-in when the session can no longer be refreshed', async () => {
    // The expired-session journey: every request 401s and the refresh fails.
    server.use(
      http.get('*/api/garage', () => HttpResponse.json({ code: 401, status: 'x' }, { status: 401 })),
      http.get('*/api/customers/', () =>
        HttpResponse.json({ code: 401, status: 'x' }, { status: 401 }),
      ),
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ code: 401, status: 'x' }, { status: 401 }),
      ),
    )
    signInAsStaff()
    renderApp('/g1/customers')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})
