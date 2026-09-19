import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import * as api from '../../api/publicGarage'
import { ApiError } from '../../api/client'
import {
  makeBookingFlow,
  makeBookingFlowField,
  makeBookingFlowSection,
  makePublicAppointmentType,
  makePublicGarage,
} from '../../test/fixtures'

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getPublicGarage: vi.fn(),
  getBookingFlow: vi.fn(),
  getGarageAvailability: vi.fn(),
  getGarageDayAvailability: vi.fn(),
  submitBookingRequest: vi.fn(),
  createDepositIntent: vi.fn(),
  getDepositStatus: vi.fn(),
}))

let confirmPaymentMock = vi.fn()
let loadStripeMock = vi.fn()

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  ExpressCheckoutElement: () => <div data-testid="express-checkout-element" />,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: confirmPaymentMock }),
  useElements: () => ({}),
}))

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: (...args: unknown[]) => loadStripeMock(...args),
}))

const TODAY = '2026-09-10'
const GARAGE = makePublicGarage({
  id: 'gid',
  name: 'Test Garage',
  slug: 'test-garage',
  appointment_types: [
    makePublicAppointmentType({
      id: 'type-deposit',
      name: 'Full Service',
      description: null,
      base_price: '100.00',
      deposit_required: true,
      deposit_type: 'FIXED',
      deposit_value: '20.00',
    }),
  ],
})

function renderWizard() {
  return renderWithAppProviders(
    <Routes>
      <Route path="/book/:garageId" element={<BookingWizard />} />
    </Routes>,
    { route: '/book/test-garage' },
  )
}

async function fillDetailsAndReachDeposit(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Test Garage')
  // Service first - which is also what decides whether a Deposit step exists
  // at all, so it has to be chosen before the rest of the walk.
  await user.click(await screen.findByRole('button', { name: /Full Service/ }))
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
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  await screen.findByRole('heading', { name: 'Review' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 10, 9, 0, 0))
  confirmPaymentMock = vi.fn()
  loadStripeMock = vi.fn(() => Promise.resolve({}))
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

describe('BookingWizard — deposit step', () => {
  it('is skipped entirely when the selected service has no deposit', async () => {
    vi.mocked(api.getPublicGarage).mockResolvedValue({
      ...GARAGE,
      appointment_types: [{ ...GARAGE.appointment_types[0], deposit_required: false }],
    })
    vi.mocked(api.submitBookingRequest).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      booking_reference: 'BK1',
    })
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await user.click(await screen.findByRole('button', { name: /Full Service/ }))
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
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Review' })
    expect(api.createDepositIntent).not.toHaveBeenCalled()
  })

  it('shows the deposit amount and remaining balance', async () => {
    vi.mocked(api.createDepositIntent).mockResolvedValue({
      booking_request_id: 'br1',
      booking_reference: 'BK1',
      status: 'AWAITING_PAYMENT',
      payment_status: 'REQUIRES_PAYMENT',
      currency: 'GBP',
      service_total: '100.00',
      deposit_amount: '20.00',
      remaining_balance: '80.00',
      provider: 'stripe',
      checkout_mode: 'EMBEDDED',
      provider_data: {
        client_secret: 'pi_1_secret_abc',
        publishable_key: 'pk_test_123',
        stripe_account_id: 'acct_connected_123',
        available_wallets: ['apple_pay', 'google_pay'],
      },
      hold_expires_at: '2026-09-10T09:15:00Z',
    })
    const user = userEvent.setup()
    renderWizard()

    await fillDetailsAndReachDeposit(user)

    expect(screen.getByTestId('express-checkout-element')).toBeInTheDocument()
    expect(screen.getByTestId('payment-element')).toBeInTheDocument()
    expect(loadStripeMock).toHaveBeenCalledWith('pk_test_123', {
      stripeAccount: 'acct_connected_123',
    })
    expect(screen.getAllByText('£20.00', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Deposit due now/)).toBeInTheDocument()
    expect(screen.getByText('£80.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pay deposit/ })).toBeInTheDocument()
    expect(screen.getByText(/Apple Pay or Google Pay may also appear/)).toBeInTheDocument()
  })

  it('pays successfully, then finishes without submitting a second booking request', async () => {
    vi.mocked(api.createDepositIntent).mockResolvedValue({
      booking_request_id: 'br1',
      booking_reference: 'BK1',
      status: 'AWAITING_PAYMENT',
      payment_status: 'REQUIRES_PAYMENT',
      currency: 'GBP',
      service_total: '100.00',
      deposit_amount: '20.00',
      remaining_balance: '80.00',
      provider: 'stripe',
      checkout_mode: 'EMBEDDED',
      provider_data: { client_secret: 'pi_1_secret_abc', publishable_key: 'pk_test_123' },
      hold_expires_at: '2026-09-10T09:15:00Z',
    })
    confirmPaymentMock.mockResolvedValue({})
    vi.mocked(api.getDepositStatus).mockResolvedValue({
      booking_request_id: 'br1',
      booking_reference: 'BK1',
      status: 'PENDING',
      payment_status: 'SUCCEEDED',
      currency: 'GBP',
      service_total: '100.00',
      deposit_amount: '20.00',
      remaining_balance: '80.00',
      hold_expires_at: null,
    })

    const user = userEvent.setup()
    renderWizard()
    await fillDetailsAndReachDeposit(user)

    await user.click(screen.getByRole('button', { name: /Pay deposit/ }))

    await screen.findByRole('heading', { name: 'Review' })
    expect(screen.getByText('Deposit paid')).toBeInTheDocument()
    expect(screen.getByText('£80.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))
    await screen.findByRole('heading', { name: 'Request received' })
    expect(api.submitBookingRequest).not.toHaveBeenCalled()
  })

  it('shows an error and allows retrying when the card is declined', async () => {
    vi.mocked(api.createDepositIntent).mockResolvedValue({
      booking_request_id: 'br1',
      booking_reference: 'BK1',
      status: 'AWAITING_PAYMENT',
      payment_status: 'REQUIRES_PAYMENT',
      currency: 'GBP',
      service_total: '100.00',
      deposit_amount: '20.00',
      remaining_balance: '80.00',
      provider: 'stripe',
      checkout_mode: 'EMBEDDED',
      provider_data: { client_secret: 'pi_1_secret_abc', publishable_key: 'pk_test_123' },
      hold_expires_at: '2026-09-10T09:15:00Z',
    })
    confirmPaymentMock.mockResolvedValue({ error: { message: 'Your card was declined.' } })

    const user = userEvent.setup()
    renderWizard()
    await fillDetailsAndReachDeposit(user)

    await user.click(screen.getByRole('button', { name: /Pay deposit/ }))

    await waitFor(() => expect(screen.getByText('Your card was declined.')).toBeInTheDocument())
    // Still able to retry - the form/button aren't stuck disabled forever.
    expect(screen.getByRole('button', { name: /Pay deposit/ })).not.toBeDisabled()
  })

  it('returns to the time step if the payment hold expires', async () => {
    vi.mocked(api.createDepositIntent).mockResolvedValue({
      booking_request_id: 'br1',
      booking_reference: 'BK1',
      status: 'AWAITING_PAYMENT',
      payment_status: 'REQUIRES_PAYMENT',
      currency: 'GBP',
      service_total: '100.00',
      deposit_amount: '20.00',
      remaining_balance: '80.00',
      provider: 'stripe',
      checkout_mode: 'EMBEDDED',
      provider_data: { client_secret: 'pi_1_secret_abc', publishable_key: 'pk_test_123' },
      hold_expires_at: '2026-09-10T09:15:00Z',
    })
    confirmPaymentMock.mockResolvedValue({})
    vi.mocked(api.getDepositStatus).mockResolvedValue({
      booking_request_id: 'br1',
      booking_reference: 'BK1',
      status: 'EXPIRED',
      payment_status: 'CANCELLED',
      currency: 'GBP',
      service_total: '100.00',
      deposit_amount: '20.00',
      remaining_balance: '80.00',
      hold_expires_at: null,
    })

    const user = userEvent.setup()
    renderWizard()
    await fillDetailsAndReachDeposit(user)

    await user.click(screen.getByRole('button', { name: /Pay deposit/ }))

    await screen.findByText(/window expired/)
    expect(screen.getByText('Pick a date & time')).toBeInTheDocument()
  })

  it('returns to Date & time and keeps entered details if the slot is gone before payment starts', async () => {
    // Distinct from "returns to the time step if the payment hold expires"
    // above: this is a 409 on the *first* call, before any payment session
    // ever existed - see app/public_booking/routes.py::_lock_and_validate_slot.
    // Bounces straight back to Date & time rather than landing on Review at
    // all, so this doesn't use fillDetailsAndReachDeposit's own wait for the
    // Review heading.
    vi.mocked(api.createDepositIntent).mockRejectedValue(
      new ApiError({ code: 409, status: 'Conflict', message: 'Full up.' }, 'fallback'),
    )

    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await user.click(await screen.findByRole('button', { name: /Full Service/ }))
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
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByText('This time is no longer available. Please choose another time.')
    expect(screen.getByText('Pick a date & time')).toBeInTheDocument()

    // Everything but the dead slot survives the bounce-back.
    await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
    await screen.findByRole('heading', { name: 'Your details' })
    expect(screen.getByLabelText(/First name/)).toHaveValue('Alex')
    expect(screen.getByLabelText(/^Email/)).toHaveValue('alex@example.com')
  })

  it('does not treat a vehicle-reference conflict as the slot being unavailable', async () => {
    // Regression guard for a real production incident: a 409 from
    // app/booking_requests/service.py::resolve_customer_and_vehicle (a
    // different customer already owns a vehicle with this registration at
    // this garage) has nothing to do with the slot, but used to be shown
    // identically to "This time is no longer available" and bounced the
    // customer back to Date & time - see the test above for the behaviour
    // this must NOT share.
    vi.mocked(api.createDepositIntent).mockRejectedValue(
      new ApiError(
        {
          code: 409,
          status: 'Conflict',
          message:
            'An item with this reference already exists for a different customer - resolve it manually before approving.',
          errors: { reason: 'vehicle_reference_conflict' },
        },
        'fallback',
      ),
    )

    const user = userEvent.setup()
    renderWizard()
    await fillDetailsAndReachDeposit(user)

    await screen.findByText(/already registered under a different profile/)
    // Must stay on Review/Deposit, not bounce back to Date & time.
    expect(screen.queryByText('Pick a date & time')).not.toBeInTheDocument()
  })

  it('shows a clear fallback for a provider/checkout mode the frontend has no component for', async () => {
    vi.mocked(api.createDepositIntent).mockResolvedValue({
      booking_request_id: 'br1',
      booking_reference: 'BK1',
      status: 'AWAITING_PAYMENT',
      payment_status: 'REQUIRES_PAYMENT',
      currency: 'GBP',
      service_total: '100.00',
      deposit_amount: '20.00',
      remaining_balance: '80.00',
      provider: 'paypal',
      checkout_mode: 'REDIRECT',
      provider_data: { approval_url: 'https://paypal.example/approve' },
      hold_expires_at: '2026-09-10T09:15:00Z',
    })

    const user = userEvent.setup()
    renderWizard()
    await fillDetailsAndReachDeposit(user)

    expect(
      screen.getByText(/payment method isn't available online right now/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pay deposit/ })).not.toBeInTheDocument()
  })
})

describe('BookingWizard — a deposit booking still asks the business its questions', () => {
  it('sends the configured answers with the deposit intent', async () => {
    // The deposit path builds its own payload and hands it to DepositStep, so
    // it is the one place a configured question could silently be skipped -
    // and skipping it would take a *paid* booking without asking.
    vi.mocked(api.getBookingFlow).mockResolvedValue(
      makeBookingFlow({
        sections: [
          makeBookingFlowSection({
            id: 's1',
            title: 'About your visit',
            fields: [makeBookingFlowField({ id: 'f-notes', label: 'Anything we should know?' })],
          }),
        ],
      }),
    )
    const user = userEvent.setup()
    renderWizard()

    await screen.findByText('Test Garage')
    await user.click(await screen.findByRole('button', { name: /Full Service/ }))
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
    await user.type(screen.getByLabelText(/Anything we should know\?/), 'Please call first')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await screen.findByRole('heading', { name: 'Deposit' })
    await waitFor(() => expect(api.createDepositIntent).toHaveBeenCalled())
    expect(api.createDepositIntent).toHaveBeenCalledWith(
      'test-garage',
      expect.objectContaining({
        answers: [{ field_id: 'f-notes', value: 'Please call first' }],
        payment_attempt_id: expect.any(String),
      }),
    )
  })
})
