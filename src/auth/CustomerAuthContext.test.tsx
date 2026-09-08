import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../test/msw/server'
import { makeJwt } from '../test/fixtures'
import { CustomerAuthProvider, useCustomerAuth } from './CustomerAuthContext'
import { getCustomerAccessToken, getCustomerRefreshToken } from '../api/customerTokens'
import { getAccessToken, setTokens } from '../api/tokens'

function CustomerProbe() {
  const { isAuthenticated, customerId, loginWithReference, loginWithPassword, logout } =
    useCustomerAuth()
  return (
    <div>
      <p>signed in: {String(isAuthenticated)}</p>
      <p>customer: {customerId ?? 'none'}</p>
      <button onClick={() => void loginWithReference('a@b.com', 'BK7F3K9Q2').catch(() => {})}>
        log in with reference
      </button>
      <button onClick={() => void loginWithPassword('a@b.com', 'hunter2222').catch(() => {})}>
        log in with password
      </button>
      <button onClick={logout}>log out</button>
    </div>
  )
}

const renderProbe = () =>
  render(
    <CustomerAuthProvider>
      <CustomerProbe />
    </CustomerAuthProvider>,
  )

describe('CustomerAuthProvider', () => {
  it('starts signed out with no stored customer token', () => {
    renderProbe()
    expect(screen.getByText('signed in: false')).toBeInTheDocument()
  })

  it('is not signed in just because a staff session exists in the same browser', () => {
    // The two portals share a browser but must never share a session.
    setTokens(makeJwt('e1'), makeJwt('e1'))
    renderProbe()
    expect(screen.getByText('signed in: false')).toBeInTheDocument()
  })

  it('signs in with a booking reference, storing customer-scoped tokens', async () => {
    let body: unknown
    server.use(
      http.post('*/api/customer/auth/login/reference', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ access_token: makeJwt('c7'), refresh_token: 'cr' })
      }),
    )
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log in with reference' }))

    await screen.findByText('customer: c7')
    expect(body).toEqual({ email: 'a@b.com', booking_reference: 'BK7F3K9Q2' })
    expect(getCustomerAccessToken()).toBe(makeJwt('c7'))
    expect(getCustomerRefreshToken()).toBe('cr')
  })

  it('signs in with email + password, storing customer-scoped tokens', async () => {
    let body: unknown
    server.use(
      http.post('*/api/customer/auth/login/password', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ access_token: makeJwt('c9'), refresh_token: 'cr2' })
      }),
    )
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log in with password' }))

    await screen.findByText('customer: c9')
    expect(body).toEqual({ email: 'a@b.com', password: 'hunter2222' })
    expect(getCustomerAccessToken()).toBe(makeJwt('c9'))
    expect(getCustomerRefreshToken()).toBe('cr2')
  })

  it('leaves an existing staff session untouched when a customer signs in', async () => {
    setTokens('staff-access', 'staff-refresh')
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log in with reference' }))
    await screen.findByText('signed in: true')
    expect(getAccessToken()).toBe('staff-access')
  })

  it('stays signed out when the booking reference does not match the email', async () => {
    server.use(
      http.post('*/api/customer/auth/login/reference', () =>
        HttpResponse.json({ code: 401, status: 'x', message: 'No match' }, { status: 401 }),
      ),
    )
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log in with reference' }))
    await waitFor(() => expect(getCustomerAccessToken()).toBeNull())
    expect(screen.getByText('signed in: false')).toBeInTheDocument()
  })

  it('stays signed out when the password is wrong', async () => {
    server.use(
      http.post('*/api/customer/auth/login/password', () =>
        HttpResponse.json({ code: 401, status: 'x', message: 'Invalid' }, { status: 401 }),
      ),
    )
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log in with password' }))
    await waitFor(() => expect(getCustomerAccessToken()).toBeNull())
    expect(screen.getByText('signed in: false')).toBeInTheDocument()
  })

  it('clears only the customer tokens on sign out', async () => {
    setTokens('staff-access', 'staff-refresh')
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log in with reference' }))
    await screen.findByText('signed in: true')

    await user.click(screen.getByRole('button', { name: 'log out' }))
    expect(screen.getByText('signed in: false')).toBeInTheDocument()
    expect(getCustomerAccessToken()).toBeNull()
    expect(getAccessToken()).toBe('staff-access')
  })

  it('treats a token with no subject as having no identity', () => {
    localStorage.setItem('mot_customer_access_token', makeJwt(''))
    renderProbe()
    expect(screen.getByText('customer: none')).toBeInTheDocument()
  })

  it('tells a developer when the hook is used outside its provider', () => {
    expect(() => render(<CustomerProbe />)).toThrow(
      /useCustomerAuth must be used within CustomerAuthProvider/,
    )
  })
})
