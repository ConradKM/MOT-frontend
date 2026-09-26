import { describe, expect, it } from 'vitest'
import { formatMinor } from './money'

describe('formatMinor', () => {
  it('formats a GBP minor-unit amount', () => {
    expect(formatMinor(1000, 'GBP')).toBe('£10.00')
  })

  it('formats a zero amount', () => {
    expect(formatMinor(0, 'GBP')).toBe('£0.00')
  })

  it('falls back to a plain number instead of throwing on a malformed currency code', () => {
    // The backend only checks length === 3, not that it's alphabetic - a
    // value like "123" is well-formed enough to pass that check but makes
    // Intl.NumberFormat throw a RangeError.
    expect(formatMinor(1050, '123')).toBe('10.50 123')
  })
})
