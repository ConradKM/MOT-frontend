import { describe, expect, it } from 'vitest'
import { BOOKING_BASE_URL, bookingUrl, queueStatusPath, queueUrl } from './bookingUrl'

describe('bookingUrl', () => {
  it('builds the UUID-based public booking URL', () => {
    expect(bookingUrl('11111111-2222-3333-4444-555555555555')).toBe(
      `${BOOKING_BASE_URL}/book/11111111-2222-3333-4444-555555555555`,
    )
  })

  it('defaults to the production app origin', () => {
    // No VITE_BOOKING_BASE_URL set in the test env.
    expect(BOOKING_BASE_URL).toBe('https://app.comaz.co.uk')
  })

  it('has no trailing slash', () => {
    expect(BOOKING_BASE_URL.endsWith('/')).toBe(false)
  })
})

describe('queueUrl', () => {
  it('builds the UUID-based walk-in queue URL on the same base', () => {
    expect(queueUrl('11111111-2222-3333-4444-555555555555')).toBe(
      `${BOOKING_BASE_URL}/queue/11111111-2222-3333-4444-555555555555`,
    )
  })

  it('keeps the status token in the fragment, never the path or query', () => {
    const path = queueStatusPath('g1', 'secret-token')
    expect(path).toBe('/queue/g1/status#secret-token')
    const url = new URL(path, 'https://example.test')
    expect(url.pathname).toBe('/queue/g1/status')
    expect(url.search).toBe('')
    expect(url.hash).toBe('#secret-token')
  })
})
