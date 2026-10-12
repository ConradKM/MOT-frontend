import { describe, expect, it } from 'vitest'
import { calendarDownloadQuery, type CalendarFeed } from '../api/calendarExport'
import { makeAppointmentType, makeEmployee } from '../test/fixtures'
import {
  MAX_DOWNLOAD_DAYS,
  downloadRangeError,
  feedScopeSummary,
  presetRange,
  rangeDays,
} from './calendarExport'

describe('presetRange', () => {
  it('covers today, the Monday-Sunday week, and 30 days inclusive', () => {
    expect(presetRange('today', '2026-03-11')).toEqual({ start: '2026-03-11', end: '2026-03-11' })
    expect(presetRange('week', '2026-03-11')).toEqual({ start: '2026-03-09', end: '2026-03-15' })
    const next30 = presetRange('next30', '2026-03-11')
    expect(next30).toEqual({ start: '2026-03-11', end: '2026-04-09' })
    expect(rangeDays(next30)).toBe(30)
  })

  it('is not thrown by a DST change inside the range', () => {
    // Europe/London springs forward on 29 March 2026.
    expect(rangeDays({ start: '2026-03-28', end: '2026-03-30' })).toBe(3)
  })
})

describe('downloadRangeError', () => {
  it('accepts up to the server maximum and rejects one day more', () => {
    expect(downloadRangeError({ start: '2026-01-01', end: '2027-01-01' })).toBeNull()
    expect(rangeDays({ start: '2026-01-01', end: '2027-01-01' })).toBe(MAX_DOWNLOAD_DAYS)
    expect(downloadRangeError({ start: '2026-01-01', end: '2027-01-02' })).toMatch('366 days')
  })

  it('rejects a reversed or incomplete range', () => {
    expect(downloadRangeError({ start: '2026-03-02', end: '2026-03-01' })).toMatch('on or before')
    expect(downloadRangeError({ start: '', end: '2026-03-01' })).toMatch('Choose a start')
  })
})

describe('calendarDownloadQuery', () => {
  const base = { start_date: '2026-03-01', end_date: '2026-03-31' }

  it('repeats list parameters and leaves out "all types"', () => {
    const query = calendarDownloadQuery({
      ...base,
      scope: 'SELECTED',
      employee_ids: ['e1', 'e2'],
      appointment_type_ids: null,
    })
    expect(query).toBe(
      'scope=SELECTED&start_date=2026-03-01&end_date=2026-03-31&employee_ids=e1&employee_ids=e2',
    )
  })

  it('never sends worker ids for ME or ALL', () => {
    const query = new URLSearchParams(
      calendarDownloadQuery({
        ...base,
        scope: 'ME',
        employee_ids: ['e2'],
        appointment_type_ids: ['at1'],
      }),
    )
    expect(query.getAll('employee_ids')).toEqual([])
    expect(query.getAll('appointment_type_ids')).toEqual(['at1'])
  })
})

describe('feedScopeSummary', () => {
  const feed: CalendarFeed = {
    id: 'f1',
    name: 'Phone',
    scope: 'ALL',
    employee_ids: [],
    appointment_type_ids: null,
    days_back: 7,
    days_forward: 90,
    created_by_employee_id: 'e1',
    created_at: '2026-03-01T09:00:00Z',
    last_accessed_at: null,
  }
  const employees = [
    makeEmployee(),
    makeEmployee({ id: 'e2', first_name: 'Sam', last_name: 'Spanner' }),
    makeEmployee({ id: 'e3', first_name: 'Ada', last_name: 'Lovelace' }),
    makeEmployee({ id: 'e4', first_name: 'Bo', last_name: 'Diddley' }),
  ]
  const types = [makeAppointmentType(), makeAppointmentType({ id: 'at2', name: 'Service' })]

  it('describes whose, which types and the window', () => {
    expect(feedScopeSummary(feed, employees, types)).toBe(
      'All workers · All appointment types · last 7 days to next 90 days',
    )
    expect(
      feedScopeSummary(
        { ...feed, scope: 'ME', appointment_type_ids: ['at2'], days_back: 0 },
        employees,
        types,
      ),
    ).toBe('Greg Mason · Service · today to next 90 days')
  })

  it('shortens long worker lists', () => {
    expect(
      feedScopeSummary(
        { ...feed, scope: 'SELECTED', employee_ids: ['e2', 'e3', 'e4'] },
        employees,
        types,
      ),
    ).toMatch(/^Sam Spanner, Ada Lovelace \+1 more · /)
  })
})
