import { describe, expect, it } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server'
import { makeJwt } from '../test/fixtures'
import { renderWithAppProviders } from '../test/utils'
import { SignIn } from './SignIn'
import { getAccessToken } from '../api/tokens'
import { getCustomerAccessToken } from '../api/customerTokens'
import { expectNoA11yViolations } from '../test/a11y'

function renderSignIn(route: '/login' | '/customer/login' = '/login') {
  return renderWithAppProviders(
    <Routes>
      <Route path="/login" element={<SignIn />} />
      <Route path="/customer/login" element={<SignIn />} />
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      <Route path="/customer/account" element={<h1>Account hub</h1>} />
    </Routes>,
    { route },
  )
}

const signInAsBusiness = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Email'), 'greg@bennett.example')
  await user.type(screen.getByLabelText('Password'), 'correct-horse')
  await user.click(screen.getByRole('button', { name: 'Login' }))
}

const signInAsCustomerWithReference = async (
  user: ReturnType<typeof userEvent.setup>,
  reference = 'bk7f3k9q2',
) => {
  await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
  await user.type(screen.getByLabelText('Booking reference'), reference)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('SignIn — account-type tabs', () => {
  it('defaults to the business tab at /login', () => {
    renderSignIn('/login')
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('defaults to the customer tab at /customer/login', () => {
    renderSignIn('/customer/login')
    expect(screen.getByRole('tab', { name: 'Customer' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Booking reference')).toBeInTheDocument()
  })

  it('switches between account types', async () => {
    const user = userEvent.setup()
    renderSignIn('/login')
    expect(screen.queryByLabelText('Booking reference')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Customer' }))
    expect(screen.getByLabelText('Booking reference')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Business' }))
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('has no detectable accessibility violations on either tab', async () => {
    const user = userEvent.setup()
    const { container } = renderSignIn('/login')
    await expectNoA11yViolations(container)

    await user.click(screen.getByRole('tab', { name: 'Customer' }))
    await expectNoA11yViolations(container)
  })
})

describe('SignIn — business', () => {
  it('labels both fields and masks the password', () => {
    renderSignIn('/login')
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('will not submit an empty form', async () => {
    let posted = false
    server.use(
      http.post('*/api/auth/login', () => {
        posted = true
        return HttpResponse.json({ access_token: 'a', refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderSignIn('/login')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(posted).toBe(false)
    expect(screen.getByLabelText('Email')).toBeInvalid()
  })

  it('stores the session and lands on the dashboard', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' }),
      ),
    )
    const user = userEvent.setup()
    renderSignIn('/login')
    await signInAsBusiness(user)

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(getAccessToken()).toBe(makeJwt('e1'))
  })

  it('sends the credentials the backend expects', async () => {
    let body: unknown
    server.use(
      http.post('*/api/auth/login', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderSignIn('/login')
    await signInAsBusiness(user)
    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(body).toEqual({ email: 'greg@bennett.example', password: 'correct-horse' })
  })

  it('shows the rejection and stays on the form', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { code: 401, status: 'x', message: 'Incorrect email or password.' },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSignIn('/login')
    await signInAsBusiness(user)

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })

  it('shows server-side field errors next to the fields', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { code: 422, status: 'x', errors: { json: { email: ['Not a valid email address.'] } } },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSignIn('/login')
    await signInAsBusiness(user)
    expect(await screen.findByText('Not a valid email address.')).toBeInTheDocument()
  })

  it('disables the button and says what it is doing while signing in', async () => {
    server.use(
      http.post('*/api/auth/login', async () => {
        await delay(50)
        return HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderSignIn('/login')
    await signInAsBusiness(user)

    const button = await screen.findByRole('button', { name: 'Signing in…' })
    expect(button).toBeDisabled()
    await screen.findByRole('heading', { name: 'Dashboard' })
  })

  it('sends only one login request however many times the button is clicked', async () => {
    let posts = 0
    server.use(
      http.post('*/api/auth/login', async () => {
        posts++
        await delay(30)
        return HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderSignIn('/login')
    await user.type(screen.getByLabelText('Email'), 'greg@bennett.example')
    await user.type(screen.getByLabelText('Password'), 'pw')
    await user.tripleClick(screen.getByRole('button', { name: 'Login' }))

    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(posts).toBe(1)
  })

  it('offers a forgot-password link', () => {
    renderSignIn('/login')
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })
})

describe('SignIn — customer', () => {
  it('defaults to booking-reference sign-in, with no password field visible', () => {
    renderSignIn('/customer/login')
    expect(screen.getByLabelText('Booking reference')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
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
    renderSignIn('/customer/login')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(posted).toBe(false)
  })

  it('upper-cases the booking reference as it is typed', async () => {
    const user = userEvent.setup()
    renderSignIn('/customer/login')
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
    renderSignIn('/customer/login')
    await signInAsCustomerWithReference(user)

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
    renderSignIn('/customer/login')
    await user.click(screen.getByRole('tab', { name: 'Password' }))
    await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
    await user.type(screen.getByLabelText('Password'), 'a-long-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Account hub' })).toBeInTheDocument()
    expect(body).toEqual({ email: 'oliver@example.com', password: 'a-long-password' })
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
    renderSignIn('/customer/login')
    await signInAsCustomerWithReference(user)

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
    renderSignIn('/customer/login')
    await signInAsCustomerWithReference(user)
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
    renderSignIn('/customer/login')
    await signInAsCustomerWithReference(user)
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
    renderSignIn('/customer/login')
    await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
    await user.type(screen.getByLabelText('Booking reference'), 'BK7F3K9Q2')
    await user.tripleClick(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findByRole('heading', { name: 'Account hub' })
    expect(posts).toBe(1)
  })
})
