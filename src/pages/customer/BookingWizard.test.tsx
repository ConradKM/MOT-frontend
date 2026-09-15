import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import { ApiError } from '../../api/client'
import * as api from '../../api/publicGarage'
import {
  makeBookingFlow,
  makeBookingFlowField,
  makeBookingFlowSection,
  makePublicAppointmentType,
  makePublicAppointmentTypeGroup,
  makePublicGarage,
} from '../../test/fixtures'

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

/** No services configured: the wizard has nothing to choose between, so it
 * opens straight on date & time. */
const GARAGE = makePublicGarage({ id: 'gid', name: 'Test Garage', slug: 'test-garage' })

function renderWizard(route = '/book/test-garage') {
  return renderWithAppProviders(
    <Routes>
      <Route path="/book/:garageId" element={<BookingWizard />} />
    </Routes>,
    { route },
  )
}

/** Fill "Your details" by label rather than by position.
 *
 * The old version indexed into findAllByRole('textbox'), which meant any
 * change to the form's order silently pointed the typing at the wrong fields.
 * The form is now assembled from a business's own configuration, so its order
 * is not fixed at all and positional lookup cannot work. */
async function fillYourDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/First name/), 'Alex')
  await user.type(screen.getByLabelText(/Last name/), 'Turner')
  await user.type(screen.getByLabelText(/^Email/), 'alex@example.com')
  await user.type(screen.getByLabelText(/Mobile number/), '07123456789')
}

async function pickDateAndTime(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('gridcell', { name: DAY_CELL }))
  await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
}

async function walkToReview(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Test Garage')
  expect(screen.getByText('Book an appointment')).toBeInTheDocument()

  await pickDateAndTime(user)
  await fillYourDetails(user)
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  await screen.findByRole('heading', { name: 'Review' })
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

describe('BookingWizard — a business with no services configured', () => {
  it('skips the service step rather than showing an empty one', async () => {
    renderWizard()
    await screen.findByText('Test Garage')

    expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument()
    expect(screen.getByText('Pick a date & time')).toBeInTheDocument()
    expect(screen.queryByText('What would you like to book?')).not.toBeInTheDocument()
  })

  it('shows the business logo when the garage has one', async () => {
    vi.mocked(api.getPublicGarage).mockResolvedValue({
      ...GARAGE,
      logo_url: 'https://storage.example/garages/gid/branding/logo.png',
    })
    renderWizard()

    const logo = await screen.findByRole('img', { name: /test garage logo/i })
    expect(logo).toHaveAttribute(
      'src',
      'https://storage.example/garages/gid/branding/logo.png',
    )
  })

  it('falls back to an initials badge with no logo, never a broken image', async () => {
    vi.mocked(api.getPublicGarage).mockResolvedValue(GARAGE)
    renderWizard()
    await screen.findByText('Test Garage')

    expect(screen.queryByRole('img', { name: /logo/i })).not.toBeInTheDocument()
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('carries the picked date and time into the booking request', async () => {
    vi.mocked(api.submitBookingRequest).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      booking_reference: 'BK7F3K9Q2',
    })
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
        customer_email: 'alex@example.com',
      }),
    )
    expect(await screen.findByText('Request received')).toBeInTheDocument()
    expect(screen.getByText('BK7F3K9Q2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View my account' })).toHaveAttribute(
      'href',
      '/customer/account',
    )
  })

  it('sends no vehicle fields at all', async () => {
    // The point of the change: nothing about a vehicle is built in any more,
    // so a business that books no vehicle in never mentions one.
    vi.mocked(api.submitBookingRequest).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      booking_reference: 'BK1',
    })
    const user = userEvent.setup()
    renderWizard()

    await walkToReview(user)
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    await waitFor(() => expect(api.submitBookingRequest).toHaveBeenCalled())
    const sent = vi.mocked(api.submitBookingRequest).mock.calls[0][1]
    expect(Object.keys(sent).some((k) => k.startsWith('vehicle_'))).toBe(false)
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

    expect(await screen.findByLabelText(/^Email/)).toHaveValue('alex@example.com')
    expect(screen.getByLabelText(/First name/)).toHaveValue('Alex')
  })

  it('requires a mobile number before continuing to review', async () => {
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await pickDateAndTime(user)

    await user.type(await screen.findByLabelText(/First name/), 'Alex')
    await user.type(screen.getByLabelText(/Last name/), 'Turner')
    await user.type(screen.getByLabelText(/^Email/), 'alex@example.com')
    // Mobile number left blank.
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Mobile number is required.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Review' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/Mobile number/), '0123456789') // landline-shaped
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText(/valid UK mobile number/)).toBeInTheDocument()
  })

  it('shows a notice instead of the wizard when no garage is in the URL', async () => {
    renderWithAppProviders(
      <Routes>
        <Route path="/book" element={<BookingWizard />} />
      </Routes>,
      { route: '/book' },
    )
    expect(await screen.findByText('Booking link needed')).toBeInTheDocument()
  })
})

describe('BookingWizard — choosing a service first', () => {
  const FULL_SERVICE = makePublicAppointmentType({
    id: 'type-full-service',
    name: 'Full Service',
    description: 'Comprehensive service.',
    base_price: '189.00',
    default_duration_minutes: 90,
    included_items: [{ label: 'Oil and filter', description: null }],
  })
  const DIAGNOSTIC = makePublicAppointmentType({
    id: 'type-diagnostic',
    name: 'Diagnostic Check',
    description: null,
    base_price: '54.85',
    default_duration_minutes: 30,
    order: 1,
  })

  beforeEach(() => {
    vi.mocked(api.getPublicGarage).mockResolvedValue(
      makePublicGarage({
        id: 'gid',
        name: 'Test Garage',
        slug: 'test-garage',
        appointment_types: [FULL_SERVICE, DIAGNOSTIC],
      }),
    )
  })

  it('asks what is being booked before showing any calendar', async () => {
    renderWizard()

    expect(await screen.findByText('What would you like to book?')).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument()
    expect(screen.queryByRole('gridcell', { name: DAY_CELL })).not.toBeInTheDocument()
  })

  it('asks the calendar about the chosen service, not a generic appointment', async () => {
    // Day levels are computed at the service's duration, so a long service
    // must not inherit a calendar built for the generic slot length.
    const user = userEvent.setup()
    renderWizard()

    await user.click(await screen.findByRole('button', { name: /Full Service/ }))

    await waitFor(() =>
      expect(api.getGarageAvailability).toHaveBeenLastCalledWith(
        'test-garage',
        undefined,
        undefined,
        'type-full-service',
      ),
    )
  })

  it('sends the chosen service with the booking', async () => {
    vi.mocked(api.submitBookingRequest).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      booking_reference: 'BK7F3K9Q2',
    })
    const user = userEvent.setup()
    renderWizard()

    await user.click(await screen.findByRole('button', { name: /Full Service/ }))
    await pickDateAndTime(user)
    await fillYourDetails(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Review' })
    expect(screen.getByText('Full Service')).toBeInTheDocument()
    expect(screen.getByText('£189.00')).toBeInTheDocument()
    expect(screen.getByText('09:00–10:30')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))
    await waitFor(() =>
      expect(api.submitBookingRequest).toHaveBeenCalledWith(
        'test-garage',
        expect.objectContaining({ appointment_type_id: 'type-full-service' }),
      ),
    )
  })

  it('clears a picked date and time when the service is changed', async () => {
    // A different duration means different days and times are available, so
    // an earlier pick may no longer be valid at all.
    const user = userEvent.setup()
    renderWizard()

    await user.click(await screen.findByRole('button', { name: /Full Service/ }))
    await pickDateAndTime(user)
    await screen.findByRole('heading', { name: 'Your details' })

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(await screen.findByRole('button', { name: /Diagnostic Check/ }))

    expect(
      screen.queryByRole('button', { name: '09:00 — Available' }),
    ).not.toBeInTheDocument()
  })

  it('renders groups, and a grid group as image cards', async () => {
    vi.mocked(api.getPublicGarage).mockResolvedValue(
      makePublicGarage({
        id: 'gid',
        name: 'Test Garage',
        slug: 'test-garage',
        booking_display_mode: 'LIST',
        appointment_type_groups: [
          makePublicAppointmentTypeGroup({ id: 'grp1', name: 'Colour', display_mode: 'GRID' }),
        ],
        appointment_types: [
          makePublicAppointmentType({
            id: 'balayage',
            name: 'Balayage',
            group_id: 'grp1',
            image_url: 'https://example.test/balayage.jpg',
          }),
        ],
      }),
    )
    renderWizard()

    expect(await screen.findByText('Colour')).toBeInTheDocument()
    const card = await screen.findByRole('button', { name: /Balayage/ })
    expect(card.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.test/balayage.jpg',
    )
  })
})

describe('BookingWizard — deep links', () => {
  const MOT = makePublicAppointmentType({ id: 'type-mot', name: 'MOT test' })
  const SERVICE = makePublicAppointmentType({ id: 'type-service', name: 'Full Service', order: 1 })

  beforeEach(() => {
    vi.mocked(api.getPublicGarage).mockResolvedValue(
      makePublicGarage({
        id: 'gid',
        name: 'Test Garage',
        slug: 'test-garage',
        appointment_types: [MOT, SERVICE],
      }),
    )
  })

  it('?service= lands straight on the date step with that service chosen', async () => {
    renderWizard('/book/test-garage?service=type-service')

    expect(await screen.findByText('Pick a date & time')).toBeInTheDocument()
    expect(screen.getByText('Full Service')).toBeInTheDocument()
    await waitFor(() =>
      expect(api.getGarageAvailability).toHaveBeenLastCalledWith(
        'test-garage',
        undefined,
        undefined,
        'type-service',
      ),
    )
  })

  it('an unknown ?service= falls back to the picker rather than erroring', async () => {
    renderWizard('/book/test-garage?service=nope')

    expect(await screen.findByText('What would you like to book?')).toBeInTheDocument()
  })

  it('?group= auto-selects only when the group holds one service', async () => {
    vi.mocked(api.getPublicGarage).mockResolvedValue(
      makePublicGarage({
        id: 'gid',
        name: 'Test Garage',
        slug: 'test-garage',
        appointment_type_groups: [makePublicAppointmentTypeGroup({ id: 'grp1', name: 'Testing' })],
        appointment_types: [
          makePublicAppointmentType({ id: 'only-one', name: 'MOT test', group_id: 'grp1' }),
        ],
      }),
    )
    renderWizard('/book/test-garage?group=grp1')

    expect(await screen.findByText('Pick a date & time')).toBeInTheDocument()
  })

  it('?group= leaves the choice when the group holds several services', async () => {
    vi.mocked(api.getPublicGarage).mockResolvedValue(
      makePublicGarage({
        id: 'gid',
        name: 'Test Garage',
        slug: 'test-garage',
        appointment_type_groups: [makePublicAppointmentTypeGroup({ id: 'grp1', name: 'Testing' })],
        appointment_types: [
          makePublicAppointmentType({ id: 'a', name: 'MOT test', group_id: 'grp1' }),
          makePublicAppointmentType({ id: 'b', name: 'Full Service', group_id: 'grp1', order: 1 }),
        ],
      }),
    )
    renderWizard('/book/test-garage?group=grp1')

    expect(await screen.findByText('What would you like to book?')).toBeInTheDocument()
  })
})

describe('BookingWizard — a business with configured questions', () => {
  const REQUIRED_FIELD = makeBookingFlowField({
    id: 'f-length',
    label: 'Hair length',
    field_type: 'SELECT',
    is_required: true,
    options: ['Short', 'Long'],
  })
  const OPTIONAL_FIELD = makeBookingFlowField({
    id: 'f-notes',
    label: 'Anything we should know?',
    field_type: 'TEXTAREA',
  })

  beforeEach(() => {
    vi.mocked(api.getBookingFlow).mockResolvedValue(
      makeBookingFlow({
        sections: [
          makeBookingFlowSection({
            id: 's-about',
            title: 'About your appointment',
            fields: [REQUIRED_FIELD, OPTIONAL_FIELD],
          }),
        ],
      }),
    )
  })

  it('renders the business own sections alongside the built-in details', async () => {
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await pickDateAndTime(user)

    expect(await screen.findByRole('heading', { name: 'Your details' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'About your appointment' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Hair length/)).toBeInTheDocument()
  })

  it('blocks continuing until a required configured field is answered', async () => {
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await pickDateAndTime(user)
    await fillYourDetails(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Hair length is required.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Review' })).not.toBeInTheDocument()
  })

  it('sends the answers, including a blank one for a skipped optional field', async () => {
    vi.mocked(api.submitBookingRequest).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      booking_reference: 'BK1',
    })
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await pickDateAndTime(user)
    await fillYourDetails(user)
    await user.selectOptions(screen.getByLabelText(/Hair length/), 'Long')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Review' })
    await user.click(screen.getByRole('button', { name: 'Submit booking request' }))

    await waitFor(() => expect(api.submitBookingRequest).toHaveBeenCalled())
    expect(api.submitBookingRequest).toHaveBeenCalledWith(
      'test-garage',
      expect.objectContaining({
        answers: [
          { field_id: 'f-length', value: 'Long' },
          { field_id: 'f-notes', value: null },
        ],
      }),
    )
  })

  it('puts a server-side answer rejection back on the field it belongs to', async () => {
    vi.mocked(api.submitBookingRequest).mockRejectedValue(
      new ApiError(
        {
          code: 422,
          status: 'Unprocessable Entity',
          message: 'Please check the highlighted answers.',
          // List per key - the shape every 422 from this API uses.
          errors: { json: { 'f-length': ['Hair length is required.'] } },
        },
        'fallback',
      ),
    )
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await pickDateAndTime(user)
    await fillYourDetails(user)
    await user.selectOptions(screen.getByLabelText(/Hair length/), 'Long')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(await screen.findByRole('button', { name: 'Submit booking request' }))

    expect(await screen.findByText('Hair length is required.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeInTheDocument()
  })

  it('shows the answers on the review step under their own section', async () => {
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await pickDateAndTime(user)
    await fillYourDetails(user)
    await user.selectOptions(screen.getByLabelText(/Hair length/), 'Short')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Review' })
    expect(screen.getByText('Hair length')).toBeInTheDocument()
    expect(screen.getByText('Short')).toBeInTheDocument()
    expect(screen.getByText('Not provided')).toBeInTheDocument()
  })
})
