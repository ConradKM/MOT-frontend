import { describe, expect, it } from 'vitest'
import {
  addMonthsIso,
  daysInMonth,
  mondayIndex,
  monthLabel,
  startOfMonthIso,
} from './datetime'

describe('datetime month helpers', () => {
  it('startOfMonthIso returns the first of the month', () => {
    expect(startOfMonthIso('2026-09-17')).toBe('2026-09-01')
  })

  it('addMonthsIso rolls over the year', () => {
    expect(addMonthsIso('2026-11-15', 2)).toBe('2027-01-01')
    expect(addMonthsIso('2026-01-10', -1)).toBe('2025-12-01')
  })

  it('mondayIndex maps Monday to 0 and Sunday to 6', () => {
    expect(mondayIndex('2026-09-07')).toBe(0) // a Monday
    expect(mondayIndex('2026-09-13')).toBe(6) // a Sunday
  })

  it('daysInMonth knows month lengths', () => {
    expect(daysInMonth('2026-02-01')).toBe(28)
    expect(daysInMonth('2026-09-01')).toBe(30)
  })

  it('monthLabel is human readable', () => {
    expect(monthLabel('2026-09-01')).toMatch(/September 2026/)
  })
})
