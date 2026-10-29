import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import * as api from '../../api/publicGarage'
import { ApiError } from '../../api/client'
import {
  makeBookingFlow,
  makeDiscountValidation,
  makePublicAppointmentType,
  makePublicGarage,
} from '../../test/fixtures'
import { expectNoA11yViolations } from '../../test/a11y'

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getPublicGarage: vi.fn(),
  getBookingFlow: vi.fn(),
  getGarageAvailability: vi.fn(),
  getGarageDayAvailability: vi.fn(),
  submitBookingRequest: vi.fn(),
  createDepositIntent: vi.fn(),
  getDepositStatus: vi.fn(),
  recoverDepositAttempt: vi.fn(),
  validateDiscountCode: vi.fn(),
  abandonDepositAttempt: vi.fn(),
}))

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  ExpressCheckoutElement: () => <div data-testid="express-checkout-element" />,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: vi.fn() }),
  useElements: () => ({}),
}))

vi.mock('@stripe/stripe-js/pure', () => ({
  loadStripe: () => Promise.resolve({}),
}))

const TODAY = '2026-09-10'
const RECOVERY_KEY = 'comaz:public-booking-recovery:test-garage'
const GARAGE = makePublicGarage({
  id: 'gid',
  name: 'Test Garage',
  slug: 'test-garage',
  appointment_types: [
    makePublicAppointmentType({
      id: 'type-plain',
      name: 'Diagnostic',
      description: null,
      base_price: '100.00',
      deposit_required: false,
    }),
    makePublicAppointmentType({
      id: 'type-deposit',
      name: 'Full Service',
      description: null,
      base_price: '100.00',
      deposit_required: true,
      deposit_type: 'PERCENTAGE',
      deposit_value: '20.00',
    }),
  ],
})

function intent(patch: Partial<api.DepositIntentCreated> = {}): api.DepositIntentCreated {
  return {
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
    recovery_token: 'recovery-token-1',
    hold_expires_at: '2026-09-10T09:15:00Z',
    ...patch,
  }
}

function renderWizard() {
  return renderWithAppProviders(
    <Routes>
      <Route path="/book/:garageId" element={<BookingWizard />} />
    </Routes>,
    { route: '/book/test-garage' },
  )
}

/** The Review card - the slim summary bar repeats the price, so assertions
 * about Review's own breakdown are scoped to it. */
const reviewPanel = () => screen.getByRole('heading', { name: 'Review' }).parentElement as HTMLElement

async function reachReview(user: ReturnType<typeof userEvent.setup>, service: RegExp) {
  await screen.findByText('Test Garage')
  await user.click(await screen.findByRole('button', { name: service }))
  // Picking only selects; the summary overlay's Next moves on.
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(
    await screen.findByRole('gridcell', { name: /10 September 2026 — Good availability, selectable/ }),
  )
  await user.click(await screen.findByRole('button', { name: '09:00, Available' }))
  await user.type(await screen.findByLabelText(/First name/), 'Alex')
  await user.type(screen.getByLabelText(/Last name/), 'Turner')
  await user.type(screen.getByLabelText(/^Email/), 'alex@example.com')
  await user.type(screen.getByLabelText(/Mobile number/), '07123456789')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { name: 'Review' })
}

async function applyCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(screen.getByRole('button', { name: 'Have a discount code?' }))
  await user.type(screen.getByLabelText('Discount code'), code)
  await user.click(screen.getByRole('button', { name: 'Apply' }))
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
    days: [{ date: TODAY, weekday: 3, is_open: true, level: 'available', open_slots: 8, total_slots: 10 }],
  })
  vi.mocked(api.getGarageDayAvailability).mockResolvedValue({
    date: TODAY,
    is_open: true,
    level: 'available',
    slots: [{ start: '09:00', status: 'available', remaining: 5, capacity: 5 }],
  })
  vi.mocked(api.submitBookingRequest).mockResolvedValue({
    id: 'br1',
    status: 'PENDING',
    booking_reference: 'BKREF1',
  })
  vi.mocked(api.abandonDepositAttempt).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('BookingWizard — discount code', () => {
  it('applies a code, shows the breakdown, and sends only the code', async () => {
    vi.mocked(api.validateDiscountCode).mockResolvedValue(makeDiscountValidation())
    const user = userEvent.setup()
    renderWizard()
    await reachReview(user, /Diagnostic/)

    await applyCode(user, 'summer10')

    expect(await screen.findByText(/applied/)).toHaveTextContent('Discount code SUMMER10 applied')
    expect(api.validateDiscountCode).toHaveBeenCalledWith('test-garage', {
      code: 'SUMMER10',
      appointment_type_id: 'type-plain',
      customer_email: 'alex@example.com',
      add_ons: [],
    })
    expect(screen.getByLabelText('was £100.00')).toBeInTheDocument()
    expect(within(reviewPanel()).getByText('£90.00')).toBeInTheDocument()
    // The bar shows what will actually be charged.
    expect(screen.getByTestId('summary-bar-details')).toHaveTextContent('£90.00')
    expect(screen.getByText('−£10.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))
    await waitFor(() => expect(api.submitBookingRequest).toHaveBeenCalled())
    const payload = vi.mocked(api.submitBookingRequest).mock.calls[0][1]
    expect(payload.discount_code).toBe('SUMMER10')
    expect(JSON.stringify(payload)).not.toMatch(/90\.00|discount_amount|new_total/)
  })

  it('shows the server’s one generic message for a bad code', async () => {
    vi.mocked(api.validateDiscountCode).mockRejectedValue(
      new ApiError({
        code: 422,
        status: 'Unprocessable Entity',
        message: "This discount code isn't valid for this booking.",
        errors: { reason: 'discount_code_invalid' },
      }, 'Request failed'),
    )
    const user = userEvent.setup()
    renderWizard()
    await reachReview(user, /Diagnostic/)
    await applyCode(user, 'NOPE')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This discount code isn't valid for this booking.",
    )
    expect(screen.queryByText(/applied/)).not.toBeInTheDocument()
    expect(within(reviewPanel()).getByText('£100.00')).toBeInTheDocument()
  })

  it('removes a code and goes back to the full price', async () => {
    vi.mocked(api.validateDiscountCode).mockResolvedValue(makeDiscountValidation())
    const user = userEvent.setup()
    renderWizard()
    await reachReview(user, /Diagnostic/)
    await applyCode(user, 'SUMMER10')
    await user.click(await screen.findByRole('button', { name: 'Remove code' }))

    expect(screen.queryByText('−£10.00')).not.toBeInTheDocument()
    expect(within(reviewPanel()).getByText('£100.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))
    await waitFor(() => expect(api.submitBookingRequest).toHaveBeenCalled())
    expect(vi.mocked(api.submitBookingRequest).mock.calls[0][1]).not.toHaveProperty('discount_code')
  })

  it('clears the code when the email changes, since it must be re-checked', async () => {
    vi.mocked(api.validateDiscountCode).mockResolvedValue(makeDiscountValidation())
    const user = userEvent.setup()
    renderWizard()
    await reachReview(user, /Diagnostic/)
    await applyCode(user, 'SUMMER10')
    await screen.findByText(/applied/)

    // The "Your details" summary's Edit link (the second section on Review).
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
    await user.type(await screen.findByLabelText(/^Email/), 'x')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Review' })

    expect(screen.queryByText(/applied/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Have a discount code?' })).toBeInTheDocument()
  })

  it('handles a code the server refuses at submit time by showing the full price', async () => {
    vi.mocked(api.validateDiscountCode).mockResolvedValue(makeDiscountValidation())
    vi.mocked(api.submitBookingRequest).mockRejectedValueOnce(
      new ApiError({
        code: 422,
        status: 'Unprocessable Entity',
        message: "This discount code isn't valid for this booking.",
        errors: { reason: 'discount_code_invalid', json: { discount_code: ['…'] } },
      }, 'Request failed'),
    )
    const user = userEvent.setup()
    renderWizard()
    await reachReview(user, /Diagnostic/)
    await applyCode(user, 'SUMMER10')
    await screen.findByText(/applied/)
    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))

    expect(await screen.findByText(/We've removed it, so the full price is shown below/)).toBeInTheDocument()
    expect(screen.queryByText('−£10.00')).not.toBeInTheDocument()
    expect(within(reviewPanel()).getByText('£100.00')).toBeInTheDocument()
    // Still on Review, not a dead end: confirming again books at full price.
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
  })

  it('re-creates the deposit checkout at the discounted price', async () => {
    vi.mocked(api.createDepositIntent)
      .mockResolvedValueOnce(intent())
      .mockResolvedValueOnce(
        intent({
          service_total: '75.00',
          deposit_amount: '15.00',
          remaining_balance: '60.00',
          discount_code: 'SAVE25',
          discount_amount: '25.00',
          price_before_discount: '100.00',
          recovery_token: 'recovery-token-2',
        }),
      )
    vi.mocked(api.validateDiscountCode).mockResolvedValue(
      makeDiscountValidation({
        code: 'SAVE25',
        discount_type: 'FIXED',
        discount_value: '25.00',
        discount_amount: '25.00',
        new_total: '75.00',
        deposit_required: true,
        deposit_amount: '15.00',
        remaining_balance: '60.00',
      }),
    )
    const user = userEvent.setup()
    renderWizard()
    await reachReview(user, /Full Service/)
    expect(await screen.findByText('Deposit due now')).toBeInTheDocument()
    expect(sessionStorage.getItem(RECOVERY_KEY)).toBe('recovery-token-1')

    await applyCode(user, 'SAVE25')

    // The hold made at the old price is given up before a new one is made.
    await waitFor(() =>
      expect(api.abandonDepositAttempt).toHaveBeenCalledWith('test-garage', 'recovery-token-1'),
    )
    await waitFor(() => expect(api.createDepositIntent).toHaveBeenCalledTimes(2))
    const [first, second] = vi.mocked(api.createDepositIntent).mock.calls
    expect(first[1]).not.toHaveProperty('discount_code')
    expect(second[1].discount_code).toBe('SAVE25')
    expect(second[1].payment_attempt_id).not.toBe(first[1].payment_attempt_id)

    // In both the review breakdown and the deposit summary, from the server.
    expect(await screen.findAllByText('Discount SAVE25')).toHaveLength(2)
    expect(await screen.findByText('£15.00')).toBeInTheDocument()
  })

  it('keeps the current checkout if its payment is already being confirmed', async () => {
    vi.mocked(api.createDepositIntent).mockResolvedValue(intent())
    vi.mocked(api.validateDiscountCode).mockResolvedValue(
      makeDiscountValidation({ deposit_required: true, deposit_amount: '18.00' }),
    )
    vi.mocked(api.abandonDepositAttempt).mockRejectedValue(
      new ApiError({
        code: 409,
        status: 'Conflict',
        message: 'Your payment is being confirmed - please wait a moment.',
        errors: { reason: 'payment_in_progress' },
      }, 'Request failed'),
    )
    const user = userEvent.setup()
    renderWizard()
    await reachReview(user, /Full Service/)
    await screen.findByText('Deposit due now')
    await applyCode(user, 'SUMMER10')

    expect(await screen.findByText('Your payment is being confirmed - please wait a moment.')).toBeInTheDocument()
    expect(screen.queryByText(/applied/)).not.toBeInTheDocument()
    expect(api.createDepositIntent).toHaveBeenCalledTimes(1)
  })

  it('books a fully discounted deposit service with no deposit step', async () => {
    vi.mocked(api.createDepositIntent).mockResolvedValue(intent())
    vi.mocked(api.validateDiscountCode).mockResolvedValue(
      makeDiscountValidation({
        code: 'FREE',
        discount_value: '100.00',
        discount_amount: '100.00',
        new_total: '0.00',
        deposit_required: false,
      }),
    )
    const user = userEvent.setup()
    renderWizard()
    await reachReview(user, /Full Service/)
    await screen.findByText('Deposit due now')
    await applyCode(user, 'FREE')

    expect(await screen.findByText(/no deposit to pay/)).toBeInTheDocument()
    expect(screen.queryByText('Deposit due now')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))
    await waitFor(() => expect(api.submitBookingRequest).toHaveBeenCalled())
    expect(vi.mocked(api.submitBookingRequest).mock.calls[0][1].discount_code).toBe('FREE')
  })

  it('has no axe violations with a code applied', async () => {
    vi.mocked(api.validateDiscountCode).mockResolvedValue(makeDiscountValidation())
    const user = userEvent.setup()
    const { container } = renderWizard()
    await reachReview(user, /Diagnostic/)
    await applyCode(user, 'SUMMER10')
    await screen.findByText(/applied/)
    await expectNoA11yViolations(container)
  })
})
