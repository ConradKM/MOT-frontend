import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { ImpersonationHandoff } from './ImpersonationHandoff'
import { renderWithAppProviders } from '../test/utils'
import { server } from '../test/msw/server'
import { getAccessToken, getRefreshToken, clearTokens } from '../api/tokens'
import { makeJwt } from '../test/fixtures'

const GRANT_TOKEN = makeJwt('e1', {
  impersonation_id: 'sess-1',
  impersonated_by_email: 'ops@comaz.example',
})

function setHash(hash: string) {
  window.history.replaceState(null, '', `/impersonate${hash}`)
}

beforeEach(() => {
  clearTokens()
  setHash('')
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('ImpersonationHandoff', () => {
  it('exchanges the code and stores the support session', async () => {
    let receivedCode: string | null = null
    server.use(
      http.post('/api/auth/impersonation/exchange', async ({ request }) => {
        receivedCode = ((await request.json()) as { code: string }).code
        return HttpResponse.json({
          access_token: GRANT_TOKEN,
          expires_at: '2026-01-01T10:15:00+00:00',
          garage: { id: 'g1', name: 'Bennett Motors' },
          employee: { id: 'e1', email: 'owner@bennett.example' },
          impersonated_by_email: 'ops@comaz.example',
        })
      }),
    )
    setHash('#code=one-time-code')

    renderWithAppProviders(<ImpersonationHandoff />, { route: '/impersonate' })

    await waitFor(() => expect(getAccessToken()).toBe(GRANT_TOKEN))
    expect(receivedCode).toBe('one-time-code')
  })

  it('stores no refresh token — a support session cannot be extended', async () => {
    server.use(
      http.post('/api/auth/impersonation/exchange', () =>
        HttpResponse.json({
          access_token: GRANT_TOKEN,
          expires_at: '2026-01-01T10:15:00+00:00',
          garage: { id: 'g1', name: 'Bennett Motors' },
          employee: { id: 'e1', email: 'owner@bennett.example' },
          impersonated_by_email: 'ops@comaz.example',
        }),
      ),
    )
    setHash('#code=one-time-code')

    renderWithAppProviders(<ImpersonationHandoff />, { route: '/impersonate' })

    await waitFor(() => expect(getAccessToken()).toBe(GRANT_TOKEN))
    expect(getRefreshToken()).toBeNull()
  })

  it('strips the code from the address bar', async () => {
    server.use(
      http.post('/api/auth/impersonation/exchange', () =>
        HttpResponse.json({
          access_token: GRANT_TOKEN,
          expires_at: '2026-01-01T10:15:00+00:00',
          garage: { id: 'g1', name: 'Bennett Motors' },
          employee: { id: 'e1', email: 'owner@bennett.example' },
          impersonated_by_email: 'ops@comaz.example',
        }),
      ),
    )
    setHash('#code=one-time-code')

    renderWithAppProviders(<ImpersonationHandoff />, { route: '/impersonate' })

    await waitFor(() => expect(getAccessToken()).toBe(GRANT_TOKEN))
    expect(window.location.hash).toBe('')
  })

  it('explains an expired or already-used link instead of hanging', async () => {
    server.use(
      http.post('/api/auth/impersonation/exchange', () =>
        HttpResponse.json(
          { code: 400, status: 'Bad Request', message: 'This impersonation link is invalid or has expired.' },
          { status: 400 },
        ),
      ),
    )
    setHash('#code=stale-code')

    renderWithAppProviders(<ImpersonationHandoff />, { route: '/impersonate' })

    expect(
      await screen.findByText(/impersonation link is invalid or has expired/i),
    ).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })

  it('handles a link with no code at all', async () => {
    renderWithAppProviders(<ImpersonationHandoff />, { route: '/impersonate' })

    expect(await screen.findByText(/missing its code/i)).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
  })
})
