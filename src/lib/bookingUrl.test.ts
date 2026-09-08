import { describe, expect, it } from 'vitest'
import { BOOKING_BASE_URL, bookingUrl } from './bookingUrl'

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
