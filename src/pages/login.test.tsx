import { describe, expect, it } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server'
import { makeJwt } from '../test/fixtures'
import { renderWithAppProviders } from '../test/utils'
import { Login } from './Login'
import { Register } from './Register'
import { getAccessToken } from '../api/tokens'
import { expectNoA11yViolations } from '../test/a11y'

function renderLogin(route = '/login') {
  return renderWithAppProviders(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<h1>Dashboard</h1>} />
    </Routes>,
    { route },
  )
}

const signIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Email'), 'greg@bennett.example')
  await user.type(screen.getByLabelText('Password'), 'correct-horse')
  await user.click(screen.getByRole('button', { name: 'Login' }))
}

describe('Login — form', () => {
  it('labels both fields and masks the password', () => {
    renderLogin()
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
    renderLogin()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(posted).toBe(false)
    expect(screen.getByLabelText('Email')).toBeInvalid()
  })

  it('will not submit a malformed email', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'pw')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(screen.getByLabelText('Email')).toBeInvalid()
  })
})

describe('Login — successful sign-in', () => {
  it('stores the session and lands on the dashboard', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' }),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)

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
    renderLogin()
    await signIn(user)
    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(body).toEqual({ email: 'greg@bennett.example', password: 'correct-horse' })
  })
})

describe('Login — failures', () => {
  it('shows the rejection and keeps the user on the form', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { code: 401, status: 'x', message: 'Incorrect email or password.' },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })

  it('does not reveal which of the two fields was wrong', async () => {
    // A message naming the email would confirm an account exists.
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json(
          { code: 401, status: 'x', message: 'Incorrect email or password.' },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)
    const message = await screen.findByText(/incorrect email or password/i)
    expect(message).toHaveTextContent(/email or password/i)
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
    renderLogin()
    await signIn(user)
    expect(await screen.findByText('Not a valid email address.')).toBeInTheDocument()
  })

  it('reports a server outage instead of appearing to hang', async () => {
    server.use(http.post('*/api/auth/login', () => HttpResponse.error()))
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)
    expect(await screen.findByText(/failed to fetch/i)).toBeInTheDocument()
  })

  it('lets the user retry after a failure, clearing the old message', async () => {
    let attempt = 0
    server.use(
      http.post('*/api/auth/login', () => {
        attempt++
        return attempt === 1
          ? HttpResponse.json({ code: 401, status: 'x', message: 'Incorrect email or password.' }, { status: 401 })
          : HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)
    await screen.findByText('Incorrect email or password.')

    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})

describe('Login — submission state', () => {
  it('disables the button and says what it is doing while signing in', async () => {
    server.use(
      http.post('*/api/auth/login', async () => {
        await delay(50)
        return HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderLogin()
    await signIn(user)

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
    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'greg@bennett.example')
    await user.type(screen.getByLabelText('Password'), 'pw')
    await user.tripleClick(screen.getByRole('button', { name: 'Login' }))

    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(posts).toBe(1)
  })
})

describe('Login — accessibility', () => {
  it('has no detectable violations', async () => {
    const { container } = renderLogin()
    await expectNoA11yViolations(container)
  })

  it('has no detectable violations while showing an error', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ code: 401, status: 'x', message: 'Nope.' }, { status: 401 }),
      ),
    )
    const user = userEvent.setup()
    const { container } = renderLogin()
    await signIn(user)
    await screen.findByText('Nope.')
    await expectNoA11yViolations(container)
  })

  it('can be completed with the keyboard alone', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' }),
      ),
    )
    const user = userEvent.setup()
    renderLogin()
    await user.tab()
    expect(screen.getByLabelText('Email')).toHaveFocus()
    await user.keyboard('greg@bennett.example')
    await user.tab()
    expect(screen.getByLabelText('Password')).toHaveFocus()
    await user.keyboard('pw{Enter}')

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})

describe('Register — garage onboarding', () => {
  const renderRegister = () =>
    renderWithAppProviders(
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>,
      { route: '/register' },
    )

  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Garage name'), 'Bennett Motors')
    await user.type(screen.getByLabelText('Owner email'), 'greg@bennett.example')
    await user.type(screen.getByLabelText('Password'), 'longenough1')
  }

  it('asks the browser to enforce a minimum password length, and says so', () => {
    // jsdom implements no `tooShort` validity state, so a real browser is the
    // only place the *enforcement* can be observed — see the Register case in
    // e2e/auth.spec.ts. What is checkable here is the contract with the
    // browser, plus the hint the user is given before they submit.
    renderRegister()
    expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8')
    expect(screen.getByText('At least 8 characters.')).toBeInTheDocument()
  })

  it('will not submit without a garage name and owner email', async () => {
    let posted = false
    server.use(
      http.post('*/api/auth/register', () => {
        posted = true
        return HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderRegister()
    await user.click(screen.getByRole('button', { name: 'Create garage' }))

    expect(posted).toBe(false)
    expect(screen.getByLabelText('Garage name')).toBeInvalid()
  })

  it('treats the owner’s name as optional', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderRegister()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Create garage' }))

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(body.first_name).toBeNull()
    expect(body.last_name).toBeNull()
  })

  it('shows the server’s field error when the email is already registered', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json(
          { code: 422, status: 'x', errors: { json: { email: ['Email already registered.'] } } },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderRegister()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Create garage' }))
    expect(await screen.findByText('Email already registered.')).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderRegister()
    await expectNoA11yViolations(container)
  })
})
