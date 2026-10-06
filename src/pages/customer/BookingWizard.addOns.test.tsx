import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import * as api from '../../api/publicGarage'
import { makeBookingFlow, makePublicAppointmentType, makePublicGarage } from '../../test/fixtures'

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getPublicGarage: vi.fn(),
  getBookingFlow: vi.fn(),
  getGarageAvailability: vi.fn(),
  getGarageDayAvailability: vi.fn(),
  submitBookingRequest: vi.fn(),
}))

const TODAY = '2026-09-10'
const DAY_CELL = /10 September 2026 — Good availability, selectable/

const SERVICE = makePublicAppointmentType({
  id: 'svc',
  name: 'Full Service',
  base_price: '100.00',
  default_duration_minutes: 60,
  add_ons: [
    {
      id: 'tyre',
      name: 'Tyre check',
      description: null,
      price_delta: '15.00',
      duration_delta_minutes: 30,
      max_quantity: 1,
      exclusivity_group: null,
    },
    {
      id: 'key',
      name: 'Key cut',
      description: null,
      price_delta: '4.00',
      duration_delta_minutes: 5,
      max_quantity: 5,
      exclusivity_group: null,
    },
  ],
})
const PLAIN = makePublicAppointmentType({ id: 'plain', name: 'Diagnostic', order: 1 })

function renderWizard(route = '/book/test-garage') {
  return renderWithAppProviders(
    <Routes>
      <Route path="/book/:garageId" element={<BookingWizard />} />
    </Routes>,
    { route },
  )
}

async function chooseAddOns(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Add extras to Full Service/ }))
  await user.click(screen.getByRole('checkbox', { name: /Tyre check/ }))
  await user.click(screen.getByRole('button', { name: 'Add one Key cut' }))
  await user.click(screen.getByRole('button', { name: 'Add one Key cut' }))
  await user.click(screen.getByRole('button', { name: 'Done' }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 10, 9, 0, 0))
  vi.mocked(api.getPublicGarage).mockResolvedValue(
    makePublicGarage({
      id: 'gid',
      name: 'Test Garage',
      slug: 'test-garage',
      appointment_types: [SERVICE, PLAIN],
    }),
  )
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
  vi.mocked(api.submitBookingRequest).mockResolvedValue({
    id: 'r1',
    status: 'PENDING',
    booking_reference: 'BK7F3K9Q2',
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('BookingWizard — add-ons', () => {
  it('stays on the service step to offer add-ons before the calendar', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(await screen.findByRole('button', { name: /Full Service/ }))

    expect(screen.getByText('What would you like to book?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add extras to Full Service/ })).toBeInTheDocument()
    expect(api.getGarageAvailability).not.toHaveBeenCalled()
  })

  it('still skips straight to the calendar for a service with no add-ons', async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(await screen.findByRole('button', { name: /Diagnostic/ }))

    expect(await screen.findByText('Pick a date & time')).toBeInTheDocument()
  })

  it('updates the total live, then asks availability about the longer job', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(await screen.findByRole('button', { name: /Full Service/ }))

    const total = screen.getByTestId('service-add-on-total')
    expect(total).toHaveTextContent('£100.00')
    expect(total).toHaveTextContent('about 1 h')

    await chooseAddOns(user)
    // £100 + £15 + 2×£4; 60 + 30 + 2×5 minutes
    expect(total).toHaveTextContent('£123.00')
    expect(total).toHaveTextContent('about 1 h 40 min')

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/Booking/)).toHaveTextContent('Full Service · 1 h 40 min')
    await waitFor(() =>
      expect(api.getGarageAvailability).toHaveBeenLastCalledWith(
        'test-garage',
        undefined,
        undefined,
        'svc',
        'key:2,tyre:1',
      ),
    )

    await user.click(await screen.findByRole('gridcell', { name: DAY_CELL }))
    await waitFor(() =>
      expect(api.getGarageDayAvailability).toHaveBeenLastCalledWith(
        'test-garage',
        TODAY,
        'svc',
        'key:2,tyre:1',
      ),
    )
  })

  it('shows the add-on-inclusive price and finish time on review and submits the selection', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(await screen.findByRole('button', { name: /Full Service/ }))
    await chooseAddOns(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await user.click(await screen.findByRole('gridcell', { name: DAY_CELL }))
    await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
    await user.type(await screen.findByLabelText(/First name/), 'Alex')
    await user.type(screen.getByLabelText(/Last name/), 'Turner')
    await user.type(screen.getByLabelText(/^Email/), 'alex@example.com')
    await user.type(screen.getByLabelText(/Mobile number/), '07123456789')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const review = await screen.findByRole('heading', { name: 'Review' })
    const panel = review.parentElement as HTMLElement
    expect(within(panel).getByText('Tyre check, 2× Key cut')).toBeInTheDocument()
    expect(within(panel).getByText('£123.00')).toBeInTheDocument()
    expect(within(panel).getByText('09:00–10:40')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))
    await waitFor(() =>
      expect(api.submitBookingRequest).toHaveBeenCalledWith(
        'test-garage',
        expect.objectContaining({
          appointment_type_id: 'svc',
          add_ons: expect.arrayContaining([
            { add_on_id: 'tyre', quantity: 1 },
            { add_on_id: 'key', quantity: 2 },
          ]),
        }),
      ),
    )
  })

  it('a ?service= deep link to a service with add-ons lands on the add-on choice', async () => {
    renderWizard('/book/test-garage?service=svc')

    expect(
      await screen.findByRole('button', { name: /Add extras to Full Service/ }),
    ).toBeInTheDocument()
  })
})
