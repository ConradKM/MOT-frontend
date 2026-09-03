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

async function walkToReview(user: ReturnType<typeof userEvent.setup>) {
  // Step 1 — garage name shown, no garage picker
  await screen.findByText('Test Garage')
  expect(screen.getByText('Book your vehicle in')).toBeInTheDocument()

  await user.click(
    await screen.findByRole('gridcell', {
      name: /10 September 2026 — Good availability, selectable/,
    }),
  )
  await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))

  // Auto-advanced to step 2 (combined vehicle + your details)
  const inputs = await screen.findAllByRole('textbox')
  await user.type(inputs[0], 'PB11REQ') // registration
  await user.type(inputs[3], 'Alex') // first name
  await user.type(inputs[4], 'Turner') // last name
  await user.type(inputs[5], 'alex@example.com') // email
  await user.type(inputs[7], 'Please call first') // notes
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  // Step 3 — review
  await screen.findByRole('heading', { name: 'Review' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 10, 9, 0, 0))
  vi.mocked(api.getPublicGarage).mockResolvedValue(GARAGE)
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

describe('BookingWizard — 3-step flow', () => {
  it('has exactly three steps and no garage-selection step', async () => {
    vi.mocked(api.getPublicGarage).mockResolvedValue(GARAGE)
    renderWizard()
    await screen.findByText('Test Garage')

    expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument()
    expect(screen.getByText('Vehicle & your details')).toBeInTheDocument()
    expect(screen.queryByText(/Choose a garage/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('carries the picked date and time into the booking request', async () => {
    vi.mocked(api.submitBookingRequest).mockResolvedValue({ id: 'r1', status: 'PENDING' })
    const user = userEvent.setup()
    renderWizard()

    await walkToReview(user)
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    await waitFor(() => expect(api.submitBookingRequest).toHaveBeenCalled())
    expect(api.submitBookingRequest).toHaveBeenCalledWith(
      'test-garage',
      expect.objectContaining({
        preferred_date: TODAY,
        preferred_time: '09:00',
        appointment_type_id: null,
        preferred_employee_note: null,
        vehicle_registration: 'PB11REQ',
        notes: 'Please call first',
      }),
    )
    expect(await screen.findByText('Request received')).toBeInTheDocument()
  })

  it('returns to the date & time step when the slot was taken (409)', async () => {
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

    await walkToReview(user)
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    expect(await screen.findByText(/no longer available/)).toBeInTheDocument()
    expect(screen.getByText('Pick a date & time')).toBeInTheDocument()
    expect(api.submitBookingRequest).toHaveBeenCalledTimes(1)
  })

  it('keeps entered details when navigating back from review', async () => {
    const user = userEvent.setup()
    renderWizard()

    await walkToReview(user)
    await user.click(screen.getByRole('button', { name: 'Back' }))

    const inputs = await screen.findAllByRole('textbox')
    expect(inputs[0]).toHaveValue('PB11REQ')
    expect(inputs[5]).toHaveValue('alex@example.com')
    expect(inputs[7]).toHaveValue('Please call first')
  })

  it('shows a notice instead of the wizard when no garage is in the URL', async () => {
    renderWithProviders(
      <ToastProvider>
        <Routes>
          <Route path="/book" element={<BookingWizard />} />
        </Routes>
      </ToastProvider>,
      { route: '/book' },
    )
    expect(await screen.findByText('Choose your garage')).toBeInTheDocument()
  })
})
