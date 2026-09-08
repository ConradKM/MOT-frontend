import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server'
import { makeJwt } from '../test/fixtures'
import { renderWithAppProviders } from '../test/utils'
import { Register } from './Register'
import { expectNoA11yViolations } from '../test/a11y'

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
    await user.type(screen.getByLabelText('Business name'), 'Bennett Motors')
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

  it('will not submit without a business name and owner email', async () => {
    let posted = false
    server.use(
      http.post('*/api/auth/register', () => {
        posted = true
        return HttpResponse.json({ access_token: makeJwt('e1'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderRegister()
    await user.click(screen.getByRole('button', { name: 'Create business' }))

    expect(posted).toBe(false)
    expect(screen.getByLabelText('Business name')).toBeInvalid()
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
    await user.click(screen.getByRole('button', { name: 'Create business' }))

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
    await user.click(screen.getByRole('button', { name: 'Create business' }))
    expect(await screen.findByText('Email already registered.')).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderRegister()
    await expectNoA11yViolations(container)
  })
})
