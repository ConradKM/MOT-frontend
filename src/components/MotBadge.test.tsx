import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MotBadge } from './MotBadge'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('MotBadge', () => {
  it.each([
    ['2026-06-01', 'Expired'],
    ['2026-07-01', 'Expiring soon'],
    ['2027-06-01', 'Valid'],
    [null, 'Unknown'],
  ])('labels a %s expiry as "%s"', (expiry, label) => {
    render(<MotBadge motExpiryDate={expiry} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('conveys the status in text, never by colour alone', () => {
    // A colour-only badge would be unreadable to a screen reader or a
    // colour-blind user — the visible label is the accessible one.
    const { container } = render(<MotBadge motExpiryDate="2026-06-01" />)
    expect(container.textContent?.trim()).toBe('Expired')
  })
})
