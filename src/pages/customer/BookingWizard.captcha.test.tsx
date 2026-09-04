import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import { ToastProvider } from '../../components/Toast'
import { ApiError } from '../../api/client'
import * as api from '../../api/publicGarage'

// Force the CAPTCHA on and make it operable from the test: clicking the button
// delivers a token the same way Turnstile's success callback would.
vi.mock('../../components/Captcha', () => ({
  captchaEnabled: true,
  Captcha: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken('test-token')}>
      Verify I am human
    </button>
  ),
}))

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getPublicGarage: vi.fn(),
  getGarageAvailability: vi.fn(),
  getGarageDayAvailability: vi.fn(),
  submitBookingRequest: vi.fn(),
}))

const TODAY = '2026-09-10'
const GARAGE = { id: 'gid', name: 'Test Garage', slug: 'test-garage', appointment_types: [] }

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
  await screen.findByText('Test Garage')
  await user.click(
    await screen.findByRole('gridcell', {
      name: /10 September 2026 — Good availability, selectable/,
    }),
  )
  await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
  const inputs = await screen.findAllByRole('textbox')
  await user.type(inputs[0], 'PB11REQ')
  await user.type(inputs[3], 'Alex')
  await user.type(inputs[4], 'Turner')
  await user.type(inputs[5], 'alex@example.com')
  await user.type(inputs[6], '07123456789')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
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
    slots: [{ start: '09:00', status: 'available', remaining: 5, capacity: 5 }],
  })
  vi.mocked(api.submitBookingRequest).mockResolvedValue({ id: 'r1', status: 'PENDING' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('BookingWizard — CAPTCHA on Step 3', () => {
  it('blocks submission until the challenge is completed, then allows it', async () => {
    const user = userEvent.setup()
    renderWizard()
    await walkToReview(user)

    // The widget is on the Review step, before submit.
    expect(screen.getByRole('button', { name: 'Verify I am human' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))
    expect(screen.getByText('Please confirm that you are not a robot.')).toBeInTheDocument()
    expect(api.submitBookingRequest).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Verify I am human' }))
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    await waitFor(() => expect(api.submitBookingRequest).toHaveBeenCalled())
    expect(api.submitBookingRequest).toHaveBeenCalledWith(
      'test-garage',
      expect.objectContaining({ captcha_token: 'test-token' }),
    )
  })

  it('keeps the booking data and re-asks for the challenge after a 400', async () => {
    vi.mocked(api.submitBookingRequest).mockRejectedValueOnce(
      new ApiError({ code: 400, status: 'Bad Request', message: 'CAPTCHA verification failed.' }, 'x'),
    )
    const user = userEvent.setup()
    renderWizard()
    await walkToReview(user)

    await user.click(screen.getByRole('button', { name: 'Verify I am human' }))
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    expect(await screen.findByText(/Verification failed or expired/)).toBeInTheDocument()

    // Still on Review; details intact.
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const inputs = await screen.findAllByRole('textbox')
    expect(inputs[0]).toHaveValue('PB11REQ')
    expect(inputs[5]).toHaveValue('alex@example.com')

    // The stale token was cleared: submitting again asks for the challenge.
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Review' })
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))
    expect(screen.getByText('Please confirm that you are not a robot.')).toBeInTheDocument()
  })
})
