import { describe, expect, it } from 'vitest'
import {
  addMonthsIso,
  daysInMonth,
  formatDateNumeric,
  formatDateShort,
  formatDateTime,
  formatLongDate,
  formatShortDate,
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

describe('UK-friendly presentation formats', () => {
  it('formatDateShort always shows a 3-letter month and the year', () => {
    expect(formatDateShort('2026-09-14')).toBe('14 Sep 2026')
    // September is the one month en-GB's own Intl data abbreviates to
    // "Sept" (4 letters) - this must stay consistent with every other month.
    expect(formatDateShort('2026-09-14')).not.toContain('Sept')
    expect(formatDateShort('2027-01-05')).toBe('5 Jan 2027')
  })

  it('formatDateShort accepts a full ISO datetime too', () => {
    expect(formatDateShort('2026-09-14T09:30:00+00:00')).toBe('14 Sep 2026')
  })

  it('formatDateNumeric is day/month/year, not US month/day/year', () => {
    expect(formatDateNumeric('2026-09-14')).toBe('14/09/2026')
  })

  it('formatDateTime combines the short date and the time', () => {
    // A winter date/time - no UK daylight-saving offset to account for.
    expect(formatDateTime('2026-01-14T09:05:00+00:00')).toBe('14 Jan 2026, 09:05')
  })

  it('formatShortDate is weekday + day + 3-letter month, no year', () => {
    expect(formatShortDate('2026-09-14')).toBe('Mon 14 Sep')
  })

  it('formatLongDate is day-first with a comma after the weekday', () => {
    expect(formatLongDate('2026-09-14')).toBe('Monday, 14 September 2026')
  })
})
