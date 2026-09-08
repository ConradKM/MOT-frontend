import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../test/msw/server'
import { makeJwt } from '../test/fixtures'
import { AuthProvider, useAuth } from './AuthContext'
import { apiFetch } from '../api/client'
import { getAccessToken, getRefreshToken, setTokens } from '../api/tokens'

/** Surfaces the context's state as text so tests can assert on what a
 * consumer component would actually see. */
function AuthProbe() {
  const { isAuthenticated, employeeId, login, register, logout } = useAuth()
  return (
    <div>
      <p>signed in: {String(isAuthenticated)}</p>
      <p>employee: {employeeId ?? 'none'}</p>
      <button onClick={() => void login('a@b.com', 'pw').catch(() => {})}>log in</button>
      <button onClick={() => void register('G', 'a@b.com', 'pw', 'A', 'B').catch(() => {})}>
        register
      </button>
      <button onClick={logout}>log out</button>
    </div>
  )
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  )

describe('AuthProvider', () => {
  it('starts signed out when there is no stored token', () => {
    renderProbe()
    expect(screen.getByText('signed in: false')).toBeInTheDocument()
    expect(screen.getByText('employee: none')).toBeInTheDocument()
  })

  it('restores an existing session from storage on mount', () => {
    // What makes a refresh of the browser keep the user signed in.
    setTokens(makeJwt('e9'), makeJwt('e9'))
    renderProbe()
    expect(screen.getByText('signed in: true')).toBeInTheDocument()
    expect(screen.getByText('employee: e9')).toBeInTheDocument()
  })

  it('stores both tokens on login and derives the employee from the token', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ access_token: makeJwt('e5'), refresh_token: 'refresh-5' }),
      ),
    )
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log in' }))

    await screen.findByText('signed in: true')
    expect(screen.getByText('employee: e5')).toBeInTheDocument()
    expect(getAccessToken()).toBe(makeJwt('e5'))
    expect(getRefreshToken()).toBe('refresh-5')
  })

  it('stays signed out and propagates the failure when login is rejected', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        HttpResponse.json({ code: 401, status: 'x', message: 'Bad credentials' }, { status: 401 }),
      ),
    )
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log in' }))

    expect(screen.getByText('signed in: false')).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })

  it('signs the new owner in immediately after registering a garage', async () => {
    server.use(
      http.post('*/api/auth/register', () =>
        HttpResponse.json({ access_token: makeJwt('owner-1'), refresh_token: 'r' }),
      ),
    )
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'register' }))
    await screen.findByText('employee: owner-1')
  })

  it('sends the registration payload the backend expects', async () => {
    let body: unknown
    server.use(
      http.post('*/api/auth/register', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ access_token: makeJwt('o'), refresh_token: 'r' })
      }),
    )
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'register' }))
    await waitFor(() =>
      expect(body).toEqual({
        garage_name: 'G',
        email: 'a@b.com',
        password: 'pw',
        first_name: 'A',
        last_name: 'B',
      }),
    )
  })

  it('clears the stored session on logout', async () => {
    setTokens(makeJwt('e9'), makeJwt('e9'))
    const user = userEvent.setup()
    renderProbe()
    await user.click(screen.getByRole('button', { name: 'log out' }))

    expect(screen.getByText('signed in: false')).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('drops the session when the API client reports an unrecoverable 401', async () => {
    // An expired refresh token must flip the UI to signed-out, not leave a
    // signed-in shell making failing requests forever.
    setTokens('stale', 'dead-refresh')
    server.use(
      http.get('*/api/things', () => HttpResponse.json({ code: 401, status: 'x' }, { status: 401 })),
      http.post('*/api/auth/refresh', () =>
        HttpResponse.json({ code: 401, status: 'x' }, { status: 401 }),
      ),
    )
    renderProbe()
    expect(screen.getByText('signed in: true')).toBeInTheDocument()

    // Wrapped in act: the client's auth-failure handler updates provider state.
    await act(async () => {
      await apiFetch('/api/things').catch(() => {})
    })

    await screen.findByText('signed in: false')
    expect(getAccessToken()).toBeNull()
  })

  it('tells a developer when the hook is used outside its provider', () => {
    // Without this the failure mode is an unhelpful "cannot read properties of null".
    expect(() => render(<AuthProbe />)).toThrow(/useAuth must be used within AuthProvider/)
  })
})
