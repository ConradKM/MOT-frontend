import { describe, expect, it } from 'vitest'
import {
  hourRangeForAppointments,
  hourRangeForColumns,
  layoutOverlaps,
  resolveDayHours,
} from './calendarLayout'
import type { GarageSchedule } from '../api/garageSchedule'
import { makeAppointment } from '../test/fixtures'

const appt = (id: string, start: string, end: string) =>
  makeAppointment({
    id,
    start_time: `2026-09-14T${start}:00+01:00`,
    end_time: `2026-09-14T${end}:00+01:00`,
  })

describe('layoutOverlaps', () => {
  it('keeps back-to-back appointments in one full-width column', () => {
    const laid = layoutOverlaps([appt('a', '09:00', '10:00'), appt('b', '10:00', '11:00')])
    expect(laid.map((p) => p.column)).toEqual([0, 0])
    expect(laid.every((p) => p.columns === 1)).toBe(true)
  })

  it('splits genuinely overlapping appointments into side-by-side columns', () => {
    const laid = layoutOverlaps([appt('a', '09:00', '10:30'), appt('b', '10:00', '11:00')])
    expect(laid.map((p) => p.column)).toEqual([0, 1])
    expect(laid.every((p) => p.columns === 2)).toBe(true)
  })

  it('reuses a freed column once an earlier appointment has ended', () => {
    // a and b overlap; c starts after a ends, so it belongs back in column 0
    // rather than opening a needless third column.
    const laid = layoutOverlaps([
      appt('a', '09:00', '10:00'),
      appt('b', '09:30', '11:00'),
      appt('c', '10:00', '10:30'),
    ])
    expect(laid.map((p) => [p.appointment.id, p.column])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 0],
    ])
    expect(laid[0].columns).toBe(2)
  })

  it('lays out appointments given in any order by start time', () => {
    const laid = layoutOverlaps([appt('late', '15:00', '16:00'), appt('early', '09:00', '10:00')])
    expect(laid.map((p) => p.appointment.id)).toEqual(['early', 'late'])
  })

  it('returns nothing, with a usable column count, for an empty day', () => {
    expect(layoutOverlaps([])).toEqual([])
  })

  it('does not reorder the caller’s array', () => {
    const input = [appt('late', '15:00', '16:00'), appt('early', '09:00', '10:00')]
    layoutOverlaps(input)
    expect(input[0].id).toBe('late')
  })
})

describe('hourRangeForAppointments', () => {
  it('uses the default working range when everything fits inside it', () => {
    expect(hourRangeForAppointments([appt('a', '09:00', '10:00')])).toEqual([7, 19])
  })

  it('expands to include an early-start appointment', () => {
    expect(hourRangeForAppointments([appt('a', '06:00', '07:00')])).toEqual([6, 19])
  })

  it('rounds a late finish up to the next whole hour so it is not clipped', () => {
    expect(hourRangeForAppointments([appt('a', '19:00', '20:30')])).toEqual([7, 21])
  })

  it('does not round up a finish that lands exactly on the hour', () => {
    expect(hourRangeForAppointments([appt('a', '19:00', '20:00')])).toEqual([7, 20])
  })

  it('always returns at least a one-hour range', () => {
    const [start, end] = hourRangeForAppointments([], 9, 9)
    expect(end).toBeGreaterThan(start)
  })
})

const schedule = (patch: Partial<GarageSchedule> = {}): GarageSchedule =>
  ({
    opening_hours: [
      // 2026-09-14 is a Monday (weekday 0).
      { weekday: 0, opens_at: '08:30', closes_at: '17:00', is_closed: false },
      { weekday: 6, opens_at: '00:00', closes_at: '00:00', is_closed: true },
    ],
    exceptions: [],
    ...patch,
  }) as GarageSchedule

describe('resolveDayHours', () => {
  it('returns undefined — not "closed" — while the schedule is still loading', () => {
    // The distinction matters: a caller must not paint the day as closed
    // before it knows.
    expect(resolveDayHours(undefined, '2026-09-14')).toBeUndefined()
  })

  it('uses the weekday’s normal opening hours', () => {
    expect(resolveDayHours(schedule(), '2026-09-14')).toEqual({
      opensMin: 8 * 60 + 30,
      closesMin: 17 * 60,
    })
  })

  it('reports a weekday the garage never opens as closed', () => {
    expect(resolveDayHours(schedule(), '2026-09-20')).toBeNull() // a Sunday
  })

  it('reports a weekday with no configured row as closed', () => {
    expect(resolveDayHours(schedule(), '2026-09-15')).toBeNull() // Tuesday, unconfigured
  })

  it('lets a same-date exception close an otherwise open day', () => {
    const s = schedule({
      exceptions: [{ id: 'x', date: '2026-09-14', is_closed: true, opens_at: null, closes_at: null }],
    } as Partial<GarageSchedule>)
    expect(resolveDayHours(s, '2026-09-14')).toBeNull()
  })

  it('lets a same-date exception override the hours', () => {
    const s = schedule({
      exceptions: [
        { id: 'x', date: '2026-09-14', is_closed: false, opens_at: '10:00', closes_at: '13:00' },
      ],
    } as Partial<GarageSchedule>)
    expect(resolveDayHours(s, '2026-09-14')).toEqual({ opensMin: 600, closesMin: 780 })
  })

  it('falls back to normal hours for an open exception that names no hours', () => {
    // "Open as normal" is what a non-closed exception without times means.
    const s = schedule({
      exceptions: [
        { id: 'x', date: '2026-09-14', is_closed: false, opens_at: null, closes_at: null },
      ],
    } as Partial<GarageSchedule>)
    expect(resolveDayHours(s, '2026-09-14')).toEqual({ opensMin: 510, closesMin: 1020 })
  })
})

describe('hourRangeForColumns', () => {
  it('widens the grid to include hours a column opens outside the default range', () => {
    // The default 07–19 working range is always included, so a garage opening
    // at 06:00 and closing at 20:00 widens the grid at both ends.
    expect(
      hourRangeForColumns([], [{ opensMin: 6 * 60, closesMin: 20 * 60 }, null, undefined]),
    ).toEqual([6, 20])
  })

  it('keeps the default working range when a column sits inside it', () => {
    expect(hourRangeForColumns([], [{ opensMin: 8 * 60, closesMin: 17 * 60 }])).toEqual([7, 19])
  })

  it('still shows an appointment booked outside the configured hours', () => {
    // A manual out-of-hours override must not be clipped off the grid.
    expect(
      hourRangeForColumns(
        [appt('a', '06:00', '07:00')],
        [{ opensMin: 9 * 60, closesMin: 17 * 60 }],
      ),
    ).toEqual([6, 19])
  })

  it('falls back to the appointment range when no column’s hours are known', () => {
    expect(hourRangeForColumns([appt('a', '09:00', '10:00')], [undefined, null])).toEqual([7, 19])
  })
})
