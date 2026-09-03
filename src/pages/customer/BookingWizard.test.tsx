import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import { ToastProvider } from '../../components/Toast'
import { ApiError } from '../../api/client'
import * as api from '../../api/publicGarage'

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getPublicGarage: vi.fn(),
  getPublicGarages: vi.fn(),
  getPublicGarageBySlug: vi.fn(),
  getGarageAvailability: vi.fn(),
  getGarageDayAvailability: vi.fn(),
  submitBookingRequest: vi.fn(),
}))

const TODAY = '2026-09-10'
const GARAGE = { id: 'gid', name: 'Test Garage', slug: 'test-garage' }

function renderWizard() {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/book/:garageId" element={<BookingWizard />} />
      </Routes>
    </ToastProvider>,
    { route: '/book/test-garage' },
  )
}

async function walkToConfirm(user: ReturnType<typeof userEvent.setup>) {
  // Step 1: garage is fixed from the URL
  await screen.findByText('Test Garage')
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  // Step 2: pick an available day, then an available slot
  const day = await screen.findByRole('gridcell', {
    name: /10 September 2026 — Good availability, selectable/,
  })
  await user.click(day)
  await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))

  // Auto-advanced to step 3
  expect(await screen.findByText('Your selected time')).toBeInTheDocument()
  const details = screen.getAllByRole('textbox')
  await user.type(details[0], 'Alex')
  await user.type(details[1], 'Turner')
  await user.type(details[2], 'alex@example.com')
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  // Step 4: vehicle
  await user.type(screen.getAllByRole('textbox')[0], 'PB11REQ')
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  // Step 5: extra details
  await screen.findByText(/Anything else/)
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  // Step 6: review
  await screen.findByText('6. Review')
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  // Step 7: confirm
  await screen.findByText('7. Confirm & submit')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 10, 9, 0, 0))
  vi.mocked(api.getPublicGarage).mockResolvedValue(GARAGE)
  vi.mocked(api.getPublicGarages).mockResolvedValue([GARAGE])
  vi.mocked(api.getPublicGarageBySlug).mockResolvedValue({
    ...GARAGE,
    appointment_types: [],
  })
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
    slots: [
      { start: '09:00', status: 'available', remaining: 5, capacity: 5 },
      { start: '09:30', status: 'booked', remaining: 0, capacity: 5 },
    ],
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('BookingWizard calendar flow', () => {
  it('carries the picked date and time into the booking request', async () => {
    vi.mocked(api.submitBookingRequest).mockResolvedValue({ id: 'r1', status: 'PENDING' })
    const user = userEvent.setup()
    renderWizard()

    await walkToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    await waitFor(() => expect(api.submitBookingRequest).toHaveBeenCalled())
    expect(api.submitBookingRequest).toHaveBeenCalledWith(
      'test-garage',
      expect.objectContaining({ preferred_date: TODAY, preferred_time: '09:00' }),
    )
    expect(await screen.findByText('Request received')).toBeInTheDocument()
  })

  it('returns to the time step when the slot was taken (409)', async () => {
    vi.mocked(api.submitBookingRequest).mockRejectedValue(
      new ApiError(
        {
          code: 409,
          status: 'Conflict',
          message: 'This time is no longer available. Please select another time.',
        },
        'fallback',
      ),
    )
    const user = userEvent.setup()
    renderWizard()

    await walkToConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    expect(await screen.findByText(/no longer available/)).toBeInTheDocument()
    expect(screen.getByText('2. Pick a date & time')).toBeInTheDocument()
    expect(api.submitBookingRequest).toHaveBeenCalledTimes(1)
  })
})
