import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithAppProviders } from '../../test/utils'
import { BookingWizard } from './BookingWizard'
import * as api from '../../api/publicGarage'

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getPublicGarage: vi.fn(),
  getGarageAvailability: vi.fn(),
  getGarageDayAvailability: vi.fn(),
  submitBookingRequest: vi.fn(),
  createDepositIntent: vi.fn(),
  getDepositStatus: vi.fn(),
}))

let confirmPaymentMock = vi.fn()

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: confirmPaymentMock }),
  useElements: () => ({}),
}))

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({}),
}))

const TODAY = '2026-09-10'
const GARAGE = {
  id: 'gid',
  name: 'Test Garage',
  slug: 'test-garage',
  logo_url: null,
  appointment_types: [
    {
      id: 'type-deposit',
      name: 'Full Service',
      description: null,
      base_price: '100.00',
      default_duration_minutes: 60,
      included_items: [],
      deposit_required: true,
      deposit_type: 'FIXED',
      deposit_value: '20.00',
      deposit_currency: 'GBP',
    },
  ],
}

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
  await user.click(
    await screen.findByRole('gridcell', {
      name: /10 September 2026 — Good availability, selectable/,
    }),
  )
  await user.click(await screen.findByRole('button', { name: /Full Service/ }))
  await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))

  const inputs = await screen.findAllByRole('textbox')
  await user.type(inputs[0], 'PB11REQ')
  await user.type(inputs[3], 'Alex')
  await user.type(inputs[4], 'Turner')
  await user.type(inputs[5], 'alex@example.com')
  await user.type(inputs[6], '07123456789')
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  await screen.findByRole('heading', { name: 'Deposit' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 10, 9, 0, 0))
  confirmPaymentMock = vi.fn()
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
    await user.click(
      await screen.findByRole('gridcell', {
        name: /10 September 2026 — Good availability, selectable/,
      }),
    )
    await user.click(await screen.findByRole('button', { name: /Full Service/ }))
    await user.click(await screen.findByRole('button', { name: '09:00 — Available' }))
    const inputs = await screen.findAllByRole('textbox')
    await user.type(inputs[0], 'PB11REQ')
    await user.type(inputs[3], 'Alex')
    await user.type(inputs[4], 'Turner')
    await user.type(inputs[5], 'alex@example.com')
    await user.type(inputs[6], '07123456789')
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
      client_secret: 'pi_1_secret_abc',
      publishable_key: 'pk_test_123',
      provider: 'fake',
      hold_expires_at: '2026-09-10T09:15:00Z',
    })
    const user = userEvent.setup()
    renderWizard()

    await fillDetailsAndReachDeposit(user)

    expect(screen.getAllByText('£20.00', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Deposit due now/)).toBeInTheDocument()
    expect(screen.getByText('£80.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pay deposit/ })).toBeInTheDocument()
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
      client_secret: 'pi_1_secret_abc',
      publishable_key: 'pk_test_123',
      provider: 'fake',
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

    await user.click(screen.getByRole('button', { name: 'Finish' }))
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
      client_secret: 'pi_1_secret_abc',
      publishable_key: 'pk_test_123',
      provider: 'fake',
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
      client_secret: 'pi_1_secret_abc',
      publishable_key: 'pk_test_123',
      provider: 'fake',
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
})
