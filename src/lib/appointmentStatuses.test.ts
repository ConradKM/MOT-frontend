import { describe, expect, it } from 'vitest'
import { statusBadgeClass, statusLabel, statusOptions } from './appointmentStatuses'
import { appointmentStatusLabels } from './appointments'
import { makeGarageStatus } from '../test/fixtures'

const CONFIG = [
  makeGarageStatus({ id: 's2', key: 'BOOKED', label: 'Booked in', color: 'blue', sort_order: 2 }),
  makeGarageStatus({ id: 's1', key: 'REQUESTED', label: 'Asked for', color: 'pink', sort_order: 1 }),
]

describe('statusLabel', () => {
  it('prefers the garage’s own label over the built-in one', () => {
    expect(statusLabel(CONFIG, 'BOOKED')).toBe('Booked in')
  })

  it('falls back to the built-in label when the garage has no config', () => {
    expect(statusLabel(undefined, 'IN_PROGRESS')).toBe('In progress')
  })

  it('falls back to the built-in label for a key the garage did not configure', () => {
    expect(statusLabel(CONFIG, 'COMPLETED')).toBe('Completed')
  })

  it('shows the raw key rather than nothing for a wholly unknown status', () => {
    expect(statusLabel(CONFIG, 'MADE_UP')).toBe('MADE_UP')
  })
})

describe('statusBadgeClass', () => {
  it('maps the garage’s colour token to badge classes', () => {
    expect(statusBadgeClass(CONFIG, 'REQUESTED')).toBe('bg-pink-100 text-pink-700')
  })

  it('accepts both spellings of grey', () => {
    expect(statusBadgeClass([makeGarageStatus({ key: 'X', color: 'grey' })], 'X')).toBe(
      statusBadgeClass([makeGarageStatus({ key: 'X', color: 'gray' })], 'X'),
    )
  })

  it('falls back to a neutral badge for an unrecognised colour token', () => {
    const config = [makeGarageStatus({ key: 'BOOKED', color: 'chartreuse' })]
    expect(statusBadgeClass(config, 'BOOKED')).toBe('bg-slate-100 text-slate-600')
  })

  it('falls back to a neutral badge for a status with no config and no built-in', () => {
    expect(statusBadgeClass(undefined, 'MADE_UP')).toBe('bg-slate-100 text-slate-600')
  })
})

describe('statusOptions', () => {
  it('returns the garage’s statuses in its configured sort order', () => {
    expect(statusOptions(CONFIG)).toEqual([
      { key: 'REQUESTED', label: 'Asked for' },
      { key: 'BOOKED', label: 'Booked in' },
    ])
  })

  it('does not mutate the caller’s config while sorting', () => {
    const input = [...CONFIG]
    statusOptions(input)
    expect(input[0].key).toBe('BOOKED')
  })

  it('offers the built-in list when the garage has configured nothing', () => {
    for (const config of [undefined, []]) {
      const options = statusOptions(config)
      expect(options).toHaveLength(7)
      expect(options[0]).toEqual({ key: 'REQUESTED', label: appointmentStatusLabels.REQUESTED })
    }
  })
})
