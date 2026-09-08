import { describe, expect, it } from 'vitest'
import { formatDurationMinutes } from './duration'

describe('formatDurationMinutes', () => {
  it('shows a sub-hour duration in minutes', () => {
    expect(formatDurationMinutes(45)).toBe('45 min')
  })

  it('shows a whole number of hours without a stray "0m"', () => {
    expect(formatDurationMinutes(120)).toBe('2h')
  })

  it('shows hours and minutes together', () => {
    expect(formatDurationMinutes(90)).toBe('1h 30m')
  })

  it('renders zero minutes as a real value, not the em-dash placeholder', () => {
    // 0 is a legitimate duration; the placeholder is reserved for "not known".
    expect(formatDurationMinutes(0)).toBe('0 min')
  })

  it('renders a placeholder when the duration is unknown', () => {
    expect(formatDurationMinutes(null)).toBe('—')
    expect(formatDurationMinutes(undefined)).toBe('—')
  })

  it('handles the exact hour boundary', () => {
    expect(formatDurationMinutes(59)).toBe('59 min')
    expect(formatDurationMinutes(60)).toBe('1h')
    expect(formatDurationMinutes(61)).toBe('1h 1m')
  })
})
