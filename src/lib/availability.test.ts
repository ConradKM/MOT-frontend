import { describe, expect, it } from 'vitest'
import { groupIntoHourBuckets } from './availability'
import type { AvailabilitySlot } from '../api/publicGarage'

function slot(start: string, status: AvailabilitySlot['status']): AvailabilitySlot {
  return { start, status, remaining: status === 'booked' ? 0 : 1, capacity: 1 }
}

describe('groupIntoHourBuckets', () => {
  it('groups slots by the hour their start time falls in', () => {
    const buckets = groupIntoHourBuckets([
      slot('09:00', 'available'),
      slot('09:55', 'available'),
      slot('10:00', 'available'),
    ])

    expect(buckets.map((b) => [b.bucketStart, b.bucketEnd])).toEqual([
      ['09:00', '10:00'],
      ['10:00', '11:00'],
    ])
    expect(buckets[0].slots).toHaveLength(2)
    expect(buckets[1].slots).toHaveLength(1)
  })

  it('reports a bucket available if any of its slots are available', () => {
    const buckets = groupIntoHourBuckets([slot('09:00', 'booked'), slot('09:30', 'available')])
    expect(buckets[0].status).toBe('available')
  })

  it('reports a bucket limited only when nothing inside is fully available', () => {
    const buckets = groupIntoHourBuckets([slot('09:00', 'booked'), slot('09:30', 'limited')])
    expect(buckets[0].status).toBe('limited')
  })

  it('reports a bucket booked when every slot inside is booked', () => {
    const buckets = groupIntoHourBuckets([slot('09:00', 'booked'), slot('09:30', 'booked')])
    expect(buckets[0].status).toBe('booked')
  })

  it('supports a custom bucket size', () => {
    const buckets = groupIntoHourBuckets(
      [slot('09:00', 'available'), slot('09:20', 'available'), slot('09:40', 'available')],
      30,
    )
    expect(buckets.map((b) => b.bucketStart)).toEqual(['09:00', '09:30'])
  })

  it('returns nothing for an empty slot list', () => {
    expect(groupIntoHourBuckets([])).toEqual([])
  })
})
