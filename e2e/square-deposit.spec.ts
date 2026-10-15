import { expect, test } from '@playwright/test'
import { respond, stubApi, stubSquareSdk } from './fixtures/api'
import { PUBLIC_GARAGE } from './fixtures/data'

/**
 * A deposit taken through Square: the business uses Square, so the wizard
 * renders the Square card form (SDK stubbed), submits the single-use token to
 * the backend, and only shows the booking as received once the status poll
 * reports the webhook-confirmed outcome.
 */

const DEPOSIT_GARAGE = {
  ...PUBLIC_GARAGE,
  appointment_types: PUBLIC_GARAGE.appointment_types.map((t) =>
    t.id === 'at1'
      ? { ...t, deposit_required: true, deposit_type: 'FIXED', deposit_value: '20.00', deposit_currency: 'GBP' }
      : t,
  ),
}

const SQUARE_INTENT = {
  booking_request_id: 'br-sq',
  booking_reference: 'BKSQ1234',
  status: 'AWAITING_PAYMENT',
  payment_status: 'REQUIRES_PAYMENT',
  currency: 'GBP',
  service_total: '54.85',
  deposit_amount: '20.00',
  remaining_balance: '34.85',
  provider: 'square',
  checkout_mode: 'EMBEDDED',
  provider_data: {
    application_id: 'sandbox-sq0idb-e2e',
    location_id: 'LOC_E2E',
    environment: 'sandbox',
    amount: '20.00',
    amount_minor: 2000,
    currency: 'GBP',
  },
  recovery_token: 'e2e-recovery-token-not-a-secret-000000000',
  hold_expires_at: '2099-09-14T09:15:00Z',
}

test('a customer pays a Square deposit and the booking is confirmed by the backend', async ({ page }) => {
  const sdk = await stubSquareSdk(page)
  let submittedToken: Record<string, unknown> | null = null
  let polls = 0
  await stubApi(page, [
    { path: /^\/api\/public\/garages\/[^/]+$/, handler: (route) => respond.json(route, DEPOSIT_GARAGE) },
    {
      method: 'POST',
      path: /\/booking-requests\/deposit-intent$/,
      handler: (route) => respond.json(route, SQUARE_INTENT, 201),
    },
    {
      method: 'POST',
      path: /\/booking-requests\/BKSQ1234\/payments\/token$/,
      handler: (route) => {
        submittedToken = JSON.parse(route.request().postData() ?? '{}')
        return respond.json(route, { ...SQUARE_INTENT, payment_status: 'PENDING', provider_data: undefined }, 202)
      },
    },
    {
      path: /\/booking-requests\/BKSQ1234\/payment-status$/,
      handler: (route) => {
        polls += 1
        // First poll: the webhook hasn't landed yet.
        return respond.json(
          route,
          polls < 2
            ? { ...SQUARE_INTENT, payment_status: 'PENDING' }
            : { ...SQUARE_INTENT, status: 'PENDING', payment_status: 'SUCCEEDED', hold_expires_at: null },
        )
      },
    },
  ])

  await page.goto('/book/g1')
  await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()
  // Nothing from Square loads before a Square deposit is due.
  expect(sdk.loads).toEqual([])

  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: '09:00 — Available' }).click()
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
  await page.getByLabel('First name').fill('Oliver')
  await page.getByLabel('Last name').fill('Bennett')
  await page.getByLabel('Email').fill('oliver@example.com')
  await page.getByLabel('Mobile number').fill('07123 456789')
  await page.getByLabel('Registration number').fill('OB08AUD')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  await expect(page.getByLabel('Card number')).toBeVisible()
  expect(sdk.loads).toEqual(['https://sandbox.web.squarecdn.com/v1/square.js'])
  expect(await page.evaluate(() => (window as unknown as { __squarePayments: unknown }).__squarePayments)).toEqual({
    applicationId: 'sandbox-sq0idb-e2e',
    locationId: 'LOC_E2E',
  })

  await page.getByRole('button', { name: 'Pay deposit — £20.00' }).click()
  await expect(page.getByText('Confirming your payment…')).toBeVisible()

  // Only once the poll reports the webhook-confirmed result.
  await expect(page.getByText('Your deposit is paid. Here is a summary of your booking.')).toBeVisible()
  await expect(page.getByText('Deposit paid')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Booking' }).click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
  expect(submittedToken).toEqual({ source_id: 'cnon:e2e-card' })
  expect(
    await page.evaluate(() => (window as unknown as { __squareVerification: { intent: string } }).__squareVerification.intent),
  ).toBe('CHARGE')
})
