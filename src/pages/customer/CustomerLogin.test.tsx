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

const signInWithReference = async (
  user: ReturnType<typeof userEvent.setup>,
  reference = 'bk7f3k9q2',
) => {
  await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
  await user.type(screen.getByLabelText('Booking reference'), reference)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

const signInWithPassword = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: 'Password' }))
  await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
  await user.type(screen.getByLabelText('Password'), 'a-long-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('CustomerLogin', () => {
  it('defaults to booking-reference sign-in, with no password field visible', () => {
    renderLogin()
    expect(screen.getByLabelText('Booking reference')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('switches to the password tab and back', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('tab', { name: 'Password' }))
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.queryByLabelText('Booking reference')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Booking reference' }))
    expect(screen.getByLabelText('Booking reference')).toBeInTheDocument()
  })

  it('will not submit without both fields', async () => {
    let posted = false
    server.use(
      http.post('*/api/customer/auth/login/reference', () => {
        posted = true
        return HttpResponse.json({ access_token: 'a', refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(posted).toBe(false)
  })

  it('upper-cases the booking reference as it is typed', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Booking reference'), 'bk7f3k9q2')
    expect(screen.getByLabelText('Booking reference')).toHaveValue('BK7F3K9Q2')
  })

  it('sends the booking reference and opens the account hub', async () => {
    let body: unknown
    server.use(
      http.post('*/api/customer/auth/login/reference', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ access_token: makeJwt('c1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await signInWithReference(user)

    expect(await screen.findByRole('heading', { name: 'Account hub' })).toBeInTheDocument()
    expect(body).toEqual({ email: 'oliver@example.com', booking_reference: 'BK7F3K9Q2' })
    expect(getCustomerAccessToken()).toBe(makeJwt('c1'))
  })

  it('signs in with email + password and opens the account hub', async () => {
    let body: unknown
    server.use(
      http.post('*/api/customer/auth/login/password', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ access_token: makeJwt('c1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await signInWithPassword(user)

    expect(await screen.findByRole('heading', { name: 'Account hub' })).toBeInTheDocument()
    expect(body).toEqual({ email: 'oliver@example.com', password: 'a-long-password' })
    expect(getCustomerAccessToken()).toBe(makeJwt('c1'))
  })

  it('shows the rejection when the reference does not match an account', async () => {
    server.use(
      http.post('*/api/customer/auth/login/reference', () =>
        HttpResponse.json(
          { code: 401, status: 'x', message: 'Invalid email or booking reference.' },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await signInWithReference(user)

    expect(await screen.findByText('Invalid email or booking reference.')).toBeInTheDocument()
    expect(getCustomerAccessToken()).toBeNull()
  })

  it('shows a server field error against the booking reference field', async () => {
    server.use(
      http.post('*/api/customer/auth/login/reference', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'x',
            errors: { json: { booking_reference: ['Length must be between 1 and 16.'] } },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await signInWithReference(user)
    expect(await screen.findByText('Length must be between 1 and 16.')).toBeInTheDocument()
  })

  it('clears errors when switching sign-in method', async () => {
    server.use(
      http.post('*/api/customer/auth/login/reference', () =>
        HttpResponse.json(
          { code: 401, status: 'x', message: 'Invalid email or booking reference.' },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await signInWithReference(user)
    await screen.findByText('Invalid email or booking reference.')

    await user.click(screen.getByRole('tab', { name: 'Password' }))
    expect(screen.queryByText('Invalid email or booking reference.')).not.toBeInTheDocument()
  })

  it('disables the button while signing in, and signs in only once', async () => {
    let posts = 0
    server.use(
      http.post('*/api/customer/auth/login/reference', async () => {
        posts++
        await delay(40)
        return HttpResponse.json({ access_token: makeJwt('c1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
    await user.type(screen.getByLabelText('Booking reference'), 'BK7F3K9Q2')
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
