import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { renderWithAppProviders } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import {
  GARAGE_ID,
  TERMS_TEXT,
  makePublicAppointmentType,
  makePublicGarage,
} from '../../test/fixtures'
import type { PublicGarage } from '../../api/publicGarage'
import { BookingWizard } from './BookingWizard'

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

const PLAIN = makePublicAppointmentType({ id: 'plain', name: 'MOT test' })
const DEPOSIT = makePublicAppointmentType({
  id: 'deposit',
  name: 'Full Service',
  base_price: '100.00',
  deposit_required: true,
  deposit_type: 'FIXED',
  deposit_value: '20.00',
})

function garageWith(patch: Partial<PublicGarage> = {}): PublicGarage {
  return makePublicGarage({
    appointment_types: [PLAIN, DEPOSIT],
    terms_and_conditions: TERMS_TEXT,
    terms_version: 1,
    ...patch,
  })
}

function serveGarage(getGarage: () => PublicGarage) {
  server.use(http.get('*/api/public/garages/:id', () => HttpResponse.json(getGarage())))
}

/** Every booking-creating request body, in order. */
function captureSubmissions() {
  const plain: Record<string, unknown>[] = []
  const deposit: Record<string, unknown>[] = []
  server.use(
    http.post('*/api/public/:slug/booking-requests', async ({ request }) => {
      plain.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(
        { id: 'br1', status: 'PENDING', booking_reference: 'BK7F3K9Q2' },
        { status: 201 },
      )
    }),
    http.post('*/api/public/:slug/booking-requests/deposit-intent', async ({ request }) => {
      deposit.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(
        {
          booking_request_id: 'br2',
          booking_reference: 'BKDEP',
          status: 'AWAITING_PAYMENT',
          payment_status: 'REQUIRES_PAYMENT',
          currency: 'GBP',
          service_total: '100.00',
          deposit_amount: '20.00',
          remaining_balance: '80.00',
          provider: 'stripe',
          checkout_mode: 'EMBEDDED',
          provider_data: { client_secret: 'pi_secret', publishable_key: 'pk_test' },
          recovery_token: 'recovery-token',
          hold_expires_at: '2099-09-14T09:15:00Z',
        },
        { status: 201 },
      )
    }),
  )
  return { plain, deposit }
}

async function reachReview(user: ReturnType<typeof userEvent.setup>, service: string) {
  renderWithAppProviders(
    <Routes>
      <Route path="/book/:garageId" element={<BookingWizard />} />
    </Routes>,
    { route: `/book/${GARAGE_ID}` },
  )
  await user.click(await screen.findByRole('button', { name: new RegExp(service) }))
  await user.click(
    await screen.findByRole('gridcell', { name: /14 September 2099 — .*selectable/ }),
  )
  await user.click(await screen.findByRole('button', { name: /^09:00/ }))
  await user.type(await screen.findByLabelText(/First name/), 'Alex')
  await user.type(screen.getByLabelText(/Last name/), 'Turner')
  await user.type(screen.getByLabelText(/^Email/), 'alex@example.com')
  await user.type(screen.getByLabelText(/Mobile number/), '07123456789')
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { name: 'Review' })
}

const termsBox = () => screen.getByRole('checkbox', { name: /I have read and accept the/ })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2099, 8, 14, 8, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
})

describe('BookingWizard — terms and conditions', () => {
  it('blocks Confirm Booking until the terms are ticked, then sends the accepted version', async () => {
    serveGarage(() => garageWith())
    const sent = captureSubmissions()
    const user = userEvent.setup()
    await reachReview(user, 'MOT test')

    const confirm = screen.getByRole('button', { name: 'Confirm Booking' })
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    await user.click(confirm)
    expect(
      await screen.findByText('Please accept the terms and conditions to continue.'),
    ).toBeInTheDocument()
    expect(sent.plain).toHaveLength(0)

    // Reading them in the popup and accepting there ticks the box.
    await user.click(screen.getByRole('button', { name: 'terms and conditions' }))
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    expect(termsBox()).toBeChecked()
    expect(confirm).not.toHaveAttribute('aria-disabled')
    expect(
      screen.queryByText('Please accept the terms and conditions to continue.'),
    ).not.toBeInTheDocument()

    await user.click(confirm)
    expect(await screen.findByText('Request received')).toBeInTheDocument()
    expect(sent.plain).toHaveLength(1)
    expect(sent.plain[0]).toMatchObject({ terms_accepted: true, terms_version: 1 })
  })

  it('shows no checkbox and sends nothing about terms for a business without them', async () => {
    serveGarage(() => garageWith({ terms_and_conditions: null, terms_version: null }))
    const sent = captureSubmissions()
    const user = userEvent.setup()
    await reachReview(user, 'MOT test')

    expect(screen.queryByRole('checkbox', { name: /accept the/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))
    await screen.findByText('Request received')
    expect(sent.plain[0]).not.toHaveProperty('terms_accepted')
    expect(sent.plain[0]).not.toHaveProperty('terms_version')
  })

  it('treats whitespace-only terms as none', async () => {
    serveGarage(() => garageWith({ terms_and_conditions: '   \n ', terms_version: 3 }))
    captureSubmissions()
    const user = userEvent.setup()
    await reachReview(user, 'MOT test')
    expect(screen.queryByRole('checkbox', { name: /accept the/ })).not.toBeInTheDocument()
  })

  it('re-prompts with the new wording when the terms changed mid-booking', async () => {
    let garage = garageWith()
    serveGarage(() => garage)
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.post('*/api/public/:slug/booking-requests', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        if (body.terms_version !== 2) {
          // The owner saved new wording while the customer was booking.
          garage = garageWith({ terms_and_conditions: 'Brand new wording.', terms_version: 2 })
          return HttpResponse.json(
            {
              code: 409,
              status: 'Conflict',
              message: 'The terms and conditions were updated.',
              errors: { reason: 'terms_version_mismatch' },
            },
            { status: 409 },
          )
        }
        return HttpResponse.json(
          { id: 'br1', status: 'PENDING', booking_reference: 'BK1' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    await reachReview(user, 'MOT test')

    await user.click(termsBox())
    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))

    expect(
      await screen.findByText('The terms were updated. Please read and accept the latest version.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(termsBox()).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'terms and conditions' }))
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Terms and conditions text' }),
      ).toHaveTextContent('Brand new wording.'),
    )
    await user.click(screen.getByRole('button', { name: 'Accept' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Booking' }))

    expect(await screen.findByText('Request received')).toBeInTheDocument()
    expect(bodies.map((b) => b.terms_version)).toEqual([1, 2])
  })

  it('takes no deposit - nor creates the request - until the terms are ticked', async () => {
    serveGarage(() => garageWith())
    const sent = captureSubmissions()
    const user = userEvent.setup()
    await reachReview(user, 'Full Service')

    expect(
      screen.getByText('Accept the terms and conditions above to continue to payment.'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument()
    expect(sent.deposit).toHaveLength(0)

    await user.click(termsBox())
    expect(await screen.findByTestId('payment-element')).toBeInTheDocument()
    expect(sent.deposit).toHaveLength(1)
    expect(sent.deposit[0]).toMatchObject({ terms_accepted: true, terms_version: 1 })
    // Payment has started with acceptance recorded - it can't be unticked here.
    expect(termsBox()).toBeDisabled()
    expect(sent.plain).toHaveLength(0)
  })

  it('re-prompts on the deposit path when the terms changed mid-booking', async () => {
    let garage = garageWith()
    serveGarage(() => garage)
    server.use(
      http.post('*/api/public/:slug/booking-requests/deposit-intent', () => {
        garage = garageWith({ terms_and_conditions: 'Deposit wording v2', terms_version: 2 })
        return HttpResponse.json(
          { code: 409, status: 'Conflict', errors: { reason: 'terms_version_mismatch' } },
          { status: 409 },
        )
      }),
    )
    const user = userEvent.setup()
    await reachReview(user, 'Full Service')
    await user.click(termsBox())

    expect(
      await screen.findByText('The terms were updated. Please read and accept the latest version.'),
    ).toBeInTheDocument()
    expect(termsBox()).not.toBeChecked()
    expect(termsBox()).toBeEnabled()
  })

  it('has no axe violations on Review with the terms checkbox', async () => {
    serveGarage(() => garageWith())
    captureSubmissions()
    const user = userEvent.setup()
    await reachReview(user, 'MOT test')
    const review = screen.getByRole('heading', { name: 'Review' }).parentElement as HTMLElement
    expect(within(review).getByRole('checkbox')).toBeInTheDocument()
    await expectNoA11yViolations(review)
  })
})
