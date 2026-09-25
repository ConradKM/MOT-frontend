import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeQueueDashboard, makeQueueEntry } from '../test/fixtures'
import {
  buildTimeline,
  clearStoredQueueToken,
  formatWait,
  minutesUntil,
  moveId,
  readStoredQueueToken,
  storeQueueToken,
  tokenFromHash,
} from './queue'

describe('formatWait', () => {
  it.each([
    [null, '—'],
    [undefined, '—'],
    [0, 'Now'],
    [-3, 'Now'],
    [25, 'about 25 min'],
    [60, 'about 1 hr'],
    [95, 'about 1 hr 35 min'],
  ])('%s -> %s', (minutes, expected) => {
    expect(formatWait(minutes)).toBe(expected)
  })
})

describe('minutesUntil', () => {
  it('rounds up and floors at zero, against the server clock', () => {
    const now = '2099-09-14T10:00:00Z'
    expect(minutesUntil('2099-09-14T10:00:30Z', now)).toBe(1)
    expect(minutesUntil('2099-09-14T10:45:00Z', now)).toBe(45)
    expect(minutesUntil('2099-09-14T09:00:00Z', now)).toBe(0)
    expect(minutesUntil(null, now)).toBeNull()
  })
})

describe('moveId', () => {
  const ids = ['a', 'b', 'c']
  it('moves up and down', () => {
    expect(moveId(ids, 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveId(ids, 'b', 1)).toEqual(['a', 'c', 'b'])
  })
  it('clamps at the ends and ignores unknown ids', () => {
    expect(moveId(ids, 'a', -1)).toBe(ids)
    expect(moveId(ids, 'c', 1)).toBe(ids)
    expect(moveId(ids, 'z', 1)).toBe(ids)
  })
})

describe('token storage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('round-trips per business', () => {
    storeQueueToken('g1', 'tok')
    expect(readStoredQueueToken('g1')).toBe('tok')
    expect(readStoredQueueToken('g2')).toBeNull()
    clearStoredQueueToken('g1')
    expect(readStoredQueueToken('g1')).toBeNull()
  })

  it('survives storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => storeQueueToken('g1', 'tok')).not.toThrow()
    expect(readStoredQueueToken('g1')).toBeNull()
  })

  it('reads the token from a link fragment', () => {
    expect(tokenFromHash('#abc')).toBe('abc')
    expect(tokenFromHash('')).toBeNull()
    expect(tokenFromHash('#')).toBeNull()
  })
})

describe('buildTimeline', () => {
  it('merges bookings and live walk-ins in time order', () => {
    const dashboard = makeQueueDashboard({
      appointments: [
        {
          id: 'a2',
          start_time: '2099-09-14T14:00:00Z',
          end_time: '2099-09-14T15:00:00Z',
          status: 'BOOKED',
          customer_name: 'Late Booking',
          appointment_type_name: 'MOT',
          employee_name: 'Ann',
          is_walk_in: false,
        },
        {
          id: 'a1',
          start_time: '2099-09-14T09:30:00Z',
          end_time: '2099-09-14T10:30:00Z',
          status: 'IN_PROGRESS',
          customer_name: 'Checked In',
          appointment_type_name: 'Service',
          employee_name: null,
          is_walk_in: true,
        },
      ],
      entries: [
        makeQueueEntry({ id: 'w', estimated_start_at: '2099-09-14T11:00:00Z' }),
        makeQueueEntry({ id: 'c', status: 'CALLED', called_at: '2099-09-14T09:58:00Z' }),
        makeQueueEntry({ id: 'x', estimated_start_at: null, fits_today: false }),
        // Finished and already-promoted entries appear via their appointment
        // (or not at all), never twice.
        makeQueueEntry({ id: 'd', status: 'DONE' }),
        makeQueueEntry({ id: 's', status: 'IN_SERVICE' }),
      ],
    })
    const timeline = buildTimeline(dashboard)
    expect(timeline.map((i) => i.key)).toEqual([
      'appt:a1',
      'entry:c',
      'entry:w',
      'appt:a2',
      'entry:x',
    ])
    expect(timeline[0].kind).toBe('walk-in')
    expect(timeline[2]).toMatchObject({ estimated: true, detail: 'Service not chosen · 30 min' })
    expect(timeline[3]).toMatchObject({ kind: 'appointment', detail: 'MOT · Ann' })
  })
})
