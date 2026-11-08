import { expect, test } from '@playwright/test'
import { respond, stubApi, stubSquareSdk } from './fixtures/api'
import { chooseMotTest } from './fixtures/booking'
import { PUBLIC_GARAGE } from './fixtures/data'

/**
 * A customer applies a discount code on Review for a deposit service: the
 * checkout opened at the full price is given up and re-created with the code,
 * so the deposit they pay is taken on the discounted total. Only the code is
 * ever sent - every amount on screen comes from the (stubbed) server.
 */

const DEPOSIT_GARAGE = {
  ...PUBLIC_GARAGE,
  appointment_types: PUBLIC_GARAGE.appointment_types.map((t) =>
    t.id === 'at1'
      ? {
          ...t,
          deposit_required: true,
          deposit_type: 'PERCENTAGE',
          deposit_value: '20.00',
          deposit_currency: 'GBP',
        }
      : t,
  ),
}

const SQUARE = {
  provider: 'square',
  checkout_mode: 'EMBEDDED',
  currency: 'GBP',
  status: 'AWAITING_PAYMENT',
  payment_status: 'REQUIRES_PAYMENT',
  hold_expires_at: '2099-09-14T09:15:00Z',
}

const FULL_PRICE_INTENT = {
  ...SQUARE,
  booking_request_id: 'br-full',
  booking_reference: 'BKFULL001',
  service_total: '54.85',
  deposit_amount: '10.97',
  remaining_balance: '43.88',
  provider_data: {
    application_id: 'sandbox-sq0idb-e2e',
    location_id: 'LOC_E2E',
    environment: 'sandbox',
    amount: '10.97',
    amount_minor: 1097,
    currency: 'GBP',
  },
  recovery_token: 'e2e-recovery-token-full-price-0000000000',
}

const DISCOUNTED_INTENT = {
  ...SQUARE,
  booking_request_id: 'br-disc',
  booking_reference: 'BKDISC001',
  service_total: '49.37',
  deposit_amount: '9.87',
  remaining_balance: '39.50',
  discount_code: 'SAVE10',
  discount_amount: '5.48',
  price_before_discount: '54.85',
  provider_data: {
    application_id: 'sandbox-sq0idb-e2e',
    location_id: 'LOC_E2E',
    environment: 'sandbox',
    amount: '9.87',
    amount_minor: 987,
    currency: 'GBP',
  },
  recovery_token: 'e2e-recovery-token-discounted-00000000000',
}

test('a discount code applied at checkout lowers the deposit the customer pays', async ({ page }) => {
  await stubSquareSdk(page)
  const intentBodies: Record<string, unknown>[] = []
  const abandoned: unknown[] = []
  let validated: Record<string, unknown> | null = null
  let paidAttempt = ''

  await stubApi(page, [
    { path: /^\/api\/public\/garages\/[^/]+$/, handler: (route) => respond.json(route, DEPOSIT_GARAGE) },
    {
      method: 'POST',
      path: /\/discount-codes\/validate$/,
      handler: (route) => {
        validated = JSON.parse(route.request().postData() ?? '{}')
        return respond.json(route, {
          code: 'SAVE10',
          discount_type: 'PERCENTAGE',
          discount_value: '10.00',
          original_total: '54.85',
          discount_amount: '5.48',
          new_total: '49.37',
          deposit_required: true,
          deposit_amount: '9.87',
          remaining_balance: '39.50',
        })
      },
    },
    {
      method: 'POST',
      path: /\/booking-requests\/deposit-intent$/,
      handler: (route) => {
        const body = JSON.parse(route.request().postData() ?? '{}')
        intentBodies.push(body)
        return respond.json(route, body.discount_code ? DISCOUNTED_INTENT : FULL_PRICE_INTENT, 201)
      },
    },
    {
      method: 'POST',
      path: /\/booking-requests\/deposit-attempt\/abandon$/,
      handler: (route) => {
        abandoned.push(JSON.parse(route.request().postData() ?? '{}'))
        return route.fulfill({ status: 204 })
      },
    },
    {
      method: 'POST',
      path: /\/booking-requests\/[^/]+\/payments\/token$/,
      handler: (route, url) => {
        paidAttempt = url.pathname.split('/').at(-3) ?? ''
        return respond.json(route, { ...DISCOUNTED_INTENT, payment_status: 'PENDING', provider_data: undefined }, 202)
      },
    },
    {
      path: /\/booking-requests\/BKDISC001\/payment-status$/,
      handler: (route) =>
        respond.json(route, {
          ...DISCOUNTED_INTENT,
          status: 'PENDING',
          payment_status: 'SUCCEEDED',
          hold_expires_at: null,
        }),
    },
  ])

  await page.goto('/book/g1')
  await chooseMotTest(page)
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: '09:00, Available' }).click()
  await page.getByLabel('First name').fill('Oliver')
  await page.getByLabel('Last name').fill('Bennett')
  await page.getByLabel('Email').fill('oliver@example.com')
  await page.getByLabel('Mobile number').fill('07123 456789')
  await page.getByLabel('Registration number').fill('OB08AUD')
  await page.getByRole('button', { name: 'Next' }).click()

  // The checkout opens at the full price first.
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay deposit — £10.97' })).toBeVisible()

  await page.getByRole('button', { name: 'Have a discount code?' }).click()
  await page.getByLabel('Discount code').fill('save10')
  await page.getByRole('button', { name: 'Apply' }).click()

  await expect(page.getByText('Discount code SAVE10 applied')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pay deposit — £9.87' })).toBeVisible()
  await expect(page.getByText('Deposit due now')).toBeVisible()

  expect(validated).toMatchObject({ code: 'SAVE10', customer_email: 'oliver@example.com' })
  // The full-price hold was given up with its own recovery token...
  expect(abandoned).toEqual([{ recovery_token: FULL_PRICE_INTENT.recovery_token }])
  // ...and the new attempt sent the code - never a price.
  expect(intentBodies).toHaveLength(2)
  expect(intentBodies[1].discount_code).toBe('SAVE10')
  expect(intentBodies[1].payment_attempt_id).not.toBe(intentBodies[0].payment_attempt_id)
  expect(JSON.stringify(intentBodies[1])).not.toMatch(/9\.87|49\.37|5\.48/)

  await page.getByRole('button', { name: 'Pay deposit — £9.87' }).click()
  await expect(page.getByText('Your deposit is paid. Here is a summary of your booking.')).toBeVisible()
  await expect(page.getByText('Discount SAVE10')).toHaveCount(2)
  expect(paidAttempt).toBe('BKDISC001')
  await page.getByRole('button', { name: 'Confirm Booking' }).click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
})
