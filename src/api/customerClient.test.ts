import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server'
import { ApiError } from './client'
import { customerApiFetch } from './customerClient'
import { setTokens } from './tokens'
import {
  clearCustomerTokens,
  getCustomerAccessToken,
  setCustomerTokens,
} from './customerTokens'

const ACCOUNT_URL = '*/api/customer/account'

beforeEach(() => clearCustomerTokens())

describe('customerApiFetch', () => {
  it('sends the customer’s own token, not the staff one', async () => {
    // Both sessions can exist in one browser; crossing them would leak a
    // staff token to the customer portal's endpoints.
    setTokens('staff-access', 'staff-refresh')
    setCustomerTokens('customer-access', 'customer-refresh')
    let auth: string | null = null
    server.use(
      http.get(ACCOUNT_URL, ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ customer: {} })
      }),
    )
    await customerApiFetch('/api/customer/account')
    expect(auth).toBe('Bearer customer-access')
  })

  it('omits the credential for a skipAuth request', async () => {
    setCustomerTokens('customer-access', 'customer-refresh')
    let auth: string | null = 'unset'
    server.use(
      http.post('*/api/customer/auth/login', ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({ access_token: 'a', refresh_token: 'r' })
      }),
    )
    await customerApiFetch('/api/customer/auth/login', {
      method: 'POST',
      body: { email: 'a@b.com' },
      skipAuth: true,
    })
    expect(auth).toBeNull()
  })

  it('refreshes against the customer refresh endpoint and retries', async () => {
    setCustomerTokens('stale', 'good-refresh')
    let refreshPath: string | undefined
    server.use(
      http.get(ACCOUNT_URL, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 401, status: 'x' }, { status: 401 }),
      ),
      http.post('*/api/customer/auth/refresh', ({ request }) => {
        refreshPath = new URL(request.url).pathname
        return HttpResponse.json({ access_token: 'fresh' })
      }),
    )

    await expect(customerApiFetch('/api/customer/account')).resolves.toEqual({ ok: true })
    expect(refreshPath).toBe('/api/customer/auth/refresh')
    expect(getCustomerAccessToken()).toBe('fresh')
  })

  it('clears only the customer session when the refresh fails', async () => {
    setTokens('staff-access', 'staff-refresh')
    setCustomerTokens('stale', 'dead-refresh')
    server.use(
      http.get(ACCOUNT_URL, () => HttpResponse.json({ code: 401, status: 'x' }, { status: 401 })),
      http.post('*/api/customer/auth/refresh', () =>
        HttpResponse.json({ code: 401, status: 'x' }, { status: 401 }),
      ),
    )

    await expect(customerApiFetch('/api/customer/account')).rejects.toBeInstanceOf(ApiError)
    expect(getCustomerAccessToken()).toBeNull()
    // The staff session in the same browser must survive untouched.
    expect(localStorage.getItem('mot_access_token')).toBe('staff-access')
  })

  it('surfaces a non-401 failure without touching the session', async () => {
    setCustomerTokens('good', 'good-refresh')
    server.use(
      http.get(ACCOUNT_URL, () =>
        HttpResponse.json({ code: 404, status: 'x', message: 'No account.' }, { status: 404 }),
      ),
    )
    await expect(customerApiFetch('/api/customer/account')).rejects.toMatchObject({
      code: 404,
      message: 'No account.',
    })
    expect(getCustomerAccessToken()).toBe('good')
  })

  it('resolves with undefined for a 204', async () => {
    setCustomerTokens('good', 'good-refresh')
    server.use(http.delete(ACCOUNT_URL, () => new HttpResponse(null, { status: 204 })))
    await expect(
      customerApiFetch('/api/customer/account', { method: 'DELETE' }),
    ).resolves.toBeUndefined()
  })
})
