import { describe, expect, it, afterEach, vi } from 'vitest'
import { screen, act } from '@testing-library/react'
import { ImpersonationBanner } from './ImpersonationBanner'
import { renderWithAppProviders } from '../test/utils'
import { setAccessToken, clearTokens } from '../api/tokens'
import { makeJwt } from '../test/fixtures'

function impersonationToken(overrides: Record<string, unknown> = {}) {
  return makeJwt('e1', {
    impersonation_id: 'sess-1',
    impersonated_by_email: 'ops@comaz.example',
    exp: Math.floor(Date.now() / 1000) + 900,
    ...overrides,
  })
}

afterEach(() => {
  clearTokens()
  vi.useRealTimers()
})

describe('ImpersonationBanner', () => {
  it('renders nothing for an ordinary staff session', () => {
    setAccessToken(makeJwt('e1'))

    renderWithAppProviders(<ImpersonationBanner />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('names the administrator driving a support session', () => {
    setAccessToken(impersonationToken())

    renderWithAppProviders(<ImpersonationBanner />)

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('CoMaz OS support session')
    expect(banner).toHaveTextContent('ops@comaz.example')
  })

  it('counts down the time left, so an expiring session looks like one', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setAccessToken(impersonationToken({ exp: Math.floor(Date.now() / 1000) + 120 }))

    renderWithAppProviders(<ImpersonationBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('2m 0s left')

    act(() => {
      vi.advanceTimersByTime(61_000)
    })

    expect(screen.getByRole('status')).toHaveTextContent('59s left')
  })

  it('says so once the session has run out', () => {
    setAccessToken(impersonationToken({ exp: Math.floor(Date.now() / 1000) - 5 }))

    renderWithAppProviders(<ImpersonationBanner />)

    expect(screen.getByRole('status')).toHaveTextContent('expired')
  })

  it('still shows the banner when the admin email is missing', () => {
    setAccessToken(impersonationToken({ impersonated_by_email: null }))

    renderWithAppProviders(<ImpersonationBanner />)

    expect(screen.getByRole('status')).toHaveTextContent('CoMaz OS support session')
  })
})
