import { beforeEach, describe, expect, it } from 'vitest'
import { clearBookingDraft, loadBookingDraft, saveBookingDraft, type BookingDraft } from './bookingDraft'

const GARAGE_ID = 'garage-1'

const sampleDraft: BookingDraft = {
  step: 'details',
  appointmentTypeId: 'type-1',
  date: '2026-09-25',
  time: '09:30',
  firstName: 'Alex',
  lastName: 'Turner',
  email: 'alex@example.com',
  phone: '07123456789',
  paymentAttemptId: 'attempt-1',
  answers: { mileage: { value: '50000', values: [] } },
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('bookingDraft', () => {
  it('returns null when nothing has been saved', () => {
    expect(loadBookingDraft(GARAGE_ID)).toBeNull()
  })

  it('round-trips a saved draft', () => {
    saveBookingDraft(GARAGE_ID, sampleDraft)
    expect(loadBookingDraft(GARAGE_ID)).toEqual(sampleDraft)
  })

  it('scopes drafts per garage so one business cannot see another\'s', () => {
    saveBookingDraft(GARAGE_ID, sampleDraft)
    expect(loadBookingDraft('some-other-garage')).toBeNull()
  })

  it('clears a saved draft', () => {
    saveBookingDraft(GARAGE_ID, sampleDraft)
    clearBookingDraft(GARAGE_ID)
    expect(loadBookingDraft(GARAGE_ID)).toBeNull()
  })

  it('ignores a draft written by a future/incompatible version', () => {
    sessionStorage.setItem(
      `comaz:booking-draft:${GARAGE_ID}`,
      JSON.stringify({ ...sampleDraft, version: 999 }),
    )
    expect(loadBookingDraft(GARAGE_ID)).toBeNull()
  })

  it('ignores corrupted JSON rather than throwing', () => {
    sessionStorage.setItem(`comaz:booking-draft:${GARAGE_ID}`, '{not json')
    expect(loadBookingDraft(GARAGE_ID)).toBeNull()
  })

  it('never stores anything under an empty garage id', () => {
    saveBookingDraft('', sampleDraft)
    expect(sessionStorage.length).toBe(0)
  })
})
