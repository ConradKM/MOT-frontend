import { describe, expect, it } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeJwt } from '../../test/fixtures'
import { renderWithAppProviders } from '../../test/utils'
import { CustomerLogin } from './CustomerLogin'
import { getCustomerAccessToken } from '../../api/customerTokens'
import { expectNoA11yViolations } from '../../test/a11y'

const renderLogin = () =>
  renderWithAppProviders(
    <Routes>
      <Route path="/customer/login" element={<CustomerLogin />} />
      <Route path="/customer/account" element={<h1>Account hub</h1>} />
    </Routes>,
    { route: '/customer/login' },
  )

const signIn = async (user: ReturnType<typeof userEvent.setup>, reg = 'ob08aud') => {
  await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
  await user.type(screen.getByLabelText('Vehicle registration'), reg)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('CustomerLogin', () => {
  it('explains the passwordless email + registration sign-in', () => {
    renderLogin()
    expect(screen.getByText(/email and one of your vehicle registrations/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it('will not submit without both fields', async () => {
    let posted = false
    server.use(
      http.post('*/api/customer/auth/login', () => {
        posted = true
        return HttpResponse.json({ access_token: 'a', refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(posted).toBe(false)
  })

  it('upper-cases the registration as it is typed', async () => {
    // Registrations are stored upper-case; normalising in the field spares the
    // customer a mismatch they cannot see.
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Vehicle registration'), 'ob08aud')
    expect(screen.getByLabelText('Vehicle registration')).toHaveValue('OB08AUD')
  })

  it('sends the normalised registration and opens the account hub', async () => {
    let body: unknown
    server.use(
      http.post('*/api/customer/auth/login', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ access_token: makeJwt('c1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)

    expect(await screen.findByRole('heading', { name: 'Account hub' })).toBeInTheDocument()
    expect(body).toEqual({ email: 'oliver@example.com', registration_number: 'OB08AUD' })
    expect(getCustomerAccessToken()).toBe(makeJwt('c1'))
  })

  it('shows the rejection when the pair does not match an account', async () => {
    server.use(
      http.post('*/api/customer/auth/login', () =>
        HttpResponse.json(
          { code: 401, status: 'x', message: 'No account matches those details.' },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)

    expect(await screen.findByText('No account matches those details.')).toBeInTheDocument()
    expect(getCustomerAccessToken()).toBeNull()
  })

  it('shows a server field error against the registration field', async () => {
    server.use(
      http.post('*/api/customer/auth/login', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'x',
            errors: { json: { registration_number: ['Not a recognised registration.'] } },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)
    expect(await screen.findByText('Not a recognised registration.')).toBeInTheDocument()
  })

  it('disables the button while signing in, and signs in only once', async () => {
    let posts = 0
    server.use(
      http.post('*/api/customer/auth/login', async () => {
        posts++
        await delay(40)
        return HttpResponse.json({ access_token: makeJwt('c1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
    await user.type(screen.getByLabelText('Vehicle registration'), 'OB08AUD')
    await user.tripleClick(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('heading', { name: 'Account hub' })
    expect(posts).toBe(1)
  })

  it('offers a way back to booking for a customer with no account yet', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /start a booking/i })).toHaveAttribute('href', '/book')
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderLogin()
    await expectNoA11yViolations(container)
  })
})
