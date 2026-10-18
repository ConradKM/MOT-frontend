import { describe, expect, it } from 'vitest'
import { percentToRatio, ratioToPercent } from './limitedThreshold'

describe('limited-availability threshold conversion', () => {
  it('shows the stored ratio as a whole percentage', () => {
    expect(ratioToPercent(0.5)).toBe('50')
    expect(ratioToPercent(0.25)).toBe('25')
    expect(ratioToPercent(0)).toBe('0')
    expect(ratioToPercent(1)).toBe('100')
    // Float noise from the database never leaks into the field.
    expect(ratioToPercent(0.15000000000000002)).toBe('15')
  })

  it('sends the percentage back as the 0-1 ratio the API expects', () => {
    expect(percentToRatio('50')).toBe(0.5)
    expect(percentToRatio('5')).toBe(0.05)
    expect(percentToRatio('100')).toBe(1)
    expect(percentToRatio('0')).toBe(0)
  })
})
