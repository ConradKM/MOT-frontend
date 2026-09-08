import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { motStatus, motStatusLabel } from './mot'

// motStatus is relative to "now", so the clock is pinned — otherwise the
// boundary cases below would drift into each other as real time passes.
const NOW = new Date('2026-06-15T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('motStatus', () => {
  it('reports "unknown" when no expiry date is on file', () => {
    expect(motStatus(null)).toBe('unknown')
    expect(motStatusLabel[motStatus(null)]).toBe('Unknown')
  })

  it('reports "expired" for a date in the past', () => {
    expect(motStatus('2026-06-14')).toBe('expired')
  })

  it('reports "expiring-soon" inside the 30-day warning window', () => {
    // 29 days out — comfortably inside the window.
    expect(motStatus('2026-07-14')).toBe('expiring-soon')
  })

  it('reports "ok" beyond the 30-day warning window', () => {
    // 31 days out — outside it.
    expect(motStatus('2026-07-16')).toBe('ok')
  })

  it('treats the 30-day mark itself as no longer urgent', () => {
    // The boundary is what a garage's "chase this customer" list keys off, so
    // it is pinned here rather than left to a >= / > accident.
    expect(motStatus('2026-07-15T12:00:00Z')).toBe('ok')
  })

  it('treats an expiry later today as still expiring soon, not expired', () => {
    expect(motStatus('2026-06-15T23:00:00Z')).toBe('expiring-soon')
  })
})
