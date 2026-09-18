import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import * as api from '../../api/publicGarage'
import { loadBookingDraft, saveBookingDraft } from '../../lib/bookingDraft'
import {
  makeBookingFlow,
  makePublicAppointmentType,
  makePublicGarage,
} from '../../test/fixtures'

// Regression coverage for "refreshing the public booking page destroys
// progress": BookingWizard persists an in-progress draft to sessionStorage
// (src/lib/bookingDraft.ts) and restores it on the next mount - which is
// exactly what happens across a real browser refresh, since a fresh mount is
// all a refresh ever gives a React app back.

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getPublicGarage: vi.fn(),
  getBookingFlow: vi.fn(),
  getGarageAvailability: vi.fn(),
  getGarageDayAvailability: vi.fn(),
  submitBookingRequest: vi.fn(),
  createDepositIntent: vi.fn(),
}))

const TODAY = '2026-09-10'
const NO_DEPOSIT_TYPE = makePublicAppointmentType({
  id: 'type-1',
  name: 'MOT Test',
  deposit_required: false,
})
const GARAGE = makePublicGarage({
  id: 'gid',
  name: 'Test Garage',
  slug: 'test-garage',
  appointment_types: [NO_DEPOSIT_TYPE],
})

function renderWizard(garageId = 'garage-a') {
  return renderWithAppProviders(
    <Routes>
      <Route path="/book/:garageId" element={<BookingWizard />} />
    </Routes>,
    { route: `/book/${garageId}` },
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 10, 9, 0, 0))
  vi.mocked(api.getPublicGarage).mockResolvedValue(GARAGE)
  vi.mocked(api.getBookingFlow).mockResolvedValue(makeBookingFlow())
  vi.mocked(api.getGarageAvailability).mockResolvedValue({
    garage: { slug: 'test-garage', name: 'Test Garage' },
    rules: {
      slot_interval_minutes: 30,
      min_lead_time_hours: 0,
      max_advance_days: 60,
      booking_window_start: TODAY,
      booking_window_end: '2026-11-09',
    },
    opening_hours: [],
    days: [
      { date: TODAY, weekday: 3, is_open: true, level: 'available', open_slots: 8, total_slots: 10 },
    ],
  })
  vi.mocked(api.getGarageDayAvailability).mockResolvedValue({
    date: TODAY,
    is_open: true,
    level: 'available',
    slots: [{ start: '09:00', status: 'available', remaining: 5, capacity: 5 }],
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

async function fillUpToDetails(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Test Garage')
  await user.click(await screen.findByRole('button', { name: /MOT Test/ }))
  await user.click(
    await screen.findByRole('gridcell', {
      name: /10 September 2026 — Good availability, selectable/,
    }),
  )
  await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
  await user.type(await screen.findByLabelText(/First name/), 'Alex')
  await user.type(screen.getByLabelText(/Last name/), 'Turner')
  await user.type(screen.getByLabelText(/^Email/), 'alex@example.com')
  await user.type(screen.getByLabelText(/Mobile number/), '07123456789')
}

describe('BookingWizard — draft persistence across a refresh', () => {
  it('restores an in-progress draft after a simulated refresh, revalidating the slot first', async () => {
    const user = userEvent.setup()
    const first = renderWizard('garage-a')
    await fillUpToDetails(user)

    // Simulating a refresh: the whole app remounts from scratch. Nothing but
    // sessionStorage survives that in a real browser either.
    first.unmount()

    renderWizard('garage-a')

    await screen.findByRole('heading', { name: 'Your details' })
    expect(screen.getByLabelText(/First name/)).toHaveValue('Alex')
    expect(screen.getByLabelText(/Last name/)).toHaveValue('Turner')
    expect(screen.getByLabelText(/^Email/)).toHaveValue('alex@example.com')
    expect(screen.getByLabelText(/Mobile number/)).toHaveValue('07123456789')
    // The restored slot was re-checked against real availability, not
    // trusted blindly - see BookingWizard.tsx's restore effect.
    expect(api.getGarageDayAvailability).toHaveBeenCalledWith('test-garage', TODAY, 'type-1')
  })

  it('drops a slot that is no longer available on restore but keeps everything else', async () => {
    const user = userEvent.setup()
    const first = renderWizard('garage-a')
    await fillUpToDetails(user)
    first.unmount()

    // Something else took the slot while the tab was refreshing - but only
    // for the restore check itself; re-picking 09:00 afterwards must still
    // see real (still-available) slots, not this same stale response.
    vi.mocked(api.getGarageDayAvailability).mockResolvedValueOnce({
      date: TODAY,
      is_open: true,
      level: 'full',
      slots: [{ start: '09:00', status: 'booked', remaining: 0, capacity: 5 }],
    })

    renderWizard('garage-a')

    await screen.findByText(/no longer available/)
    expect(screen.getByText('Pick a date & time')).toBeInTheDocument()

    // Re-pick a time and confirm the customer's own details survived.
    await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
    await screen.findByRole('heading', { name: 'Your details' })
    expect(screen.getByLabelText(/First name/)).toHaveValue('Alex')
    expect(screen.getByLabelText(/^Email/)).toHaveValue('alex@example.com')
  })

  it('does not leak one business\'s draft into another business\'s booking route', async () => {
    const user = userEvent.setup()
    const first = renderWizard('garage-a')
    await fillUpToDetails(user)
    first.unmount()

    renderWizard('garage-b')

    // A fresh business route starts at the Service step, untouched by
    // garage-a's draft.
    await screen.findByText('Test Garage')
    expect(screen.queryByLabelText(/First name/)).not.toBeInTheDocument()
    expect(loadBookingDraft('garage-b')).toBeNull()
    expect(loadBookingDraft('garage-a')).not.toBeNull()
  })

  it('clears the draft once a booking is confirmed', async () => {
    vi.mocked(api.submitBookingRequest).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      booking_reference: 'BK1',
    })
    const user = userEvent.setup()
    const first = renderWizard('garage-a')
    await fillUpToDetails(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Review' })
    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))
    await screen.findByRole('heading', { name: 'Request received' })

    expect(loadBookingDraft('garage-a')).toBeNull()

    first.unmount()
    renderWizard('garage-a')
    await screen.findByText('Test Garage')
    expect(screen.queryByLabelText(/First name/)).not.toBeInTheDocument()
  })

  it('never persists anything from a Stripe payment session', async () => {
    // A garage-scoped draft never carries a client secret, even indirectly -
    // saveBookingDraft's shape has no field for depositResult/provider_data
    // at all (see src/lib/bookingDraft.ts), so this asserts the invariant
    // holds for whatever the wizard actually wrote during a real flow.
    const user = userEvent.setup()
    renderWizard('garage-a')
    await fillUpToDetails(user)

    const draft = loadBookingDraft('garage-a')
    expect(draft).not.toBeNull()
    expect(JSON.stringify(draft)).not.toMatch(/secret|client_secret|pk_test|pk_live/i)
  })

  it('seeds a fresh draft store directly and restores from it (no UI walk needed)', () => {
    saveBookingDraft('garage-a', {
      step: 'details',
      appointmentTypeId: 'type-1',
      date: TODAY,
      time: '09:00',
      firstName: 'Sam',
      lastName: 'Ridley',
      email: 'sam@example.com',
      phone: '07987654321',
      paymentAttemptId: '',
      answers: {},
    })

    renderWizard('garage-a')

    return screen.findByRole('heading', { name: 'Your details' }).then(() => {
      expect(screen.getByLabelText(/First name/)).toHaveValue('Sam')
    })
  })
})
