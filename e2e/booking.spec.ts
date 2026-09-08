import { expect, test } from '@playwright/test'
import { respond, stubApi } from './fixtures/api'
import { BOOKING_DATE, DAY_AVAILABILITY } from './fixtures/data'

/**
 * The public booking wizard — the only unauthenticated write path in the
 * product, and the journey with the most business value.
 */

/** Drives the wizard as far as the review step. */
async function fillWizard(page: import('@playwright/test').Page) {
  await page.goto('/book/g1')
  await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()

  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('button', { name: '09:00 — Available' }).click()

  // The wizard advances to the details step as soon as a slot is picked.
  await expect(page.getByRole('heading', { name: 'Vehicle details' })).toBeVisible()
  await page.getByLabel('Registration number').fill('OB08AUD')
  await page.getByLabel('Make').fill('Audi')
  await page.getByLabel('First name').fill('Oliver')
  await page.getByLabel('Last name').fill('Bennett')
  await page.getByLabel('Email').fill('oliver@example.com')
  await page.getByLabel('Mobile number').fill('07123 456789')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
}

test('a customer books a slot end to end and sees a confirmation', async ({ page }) => {
  let submitted: Record<string, unknown> = {}
  await stubApi(page, [
    {
      method: 'POST',
      path: /\/booking-requests$/,
      handler: async (route) => {
        submitted = JSON.parse(route.request().postData() ?? '{}')
        return respond.json(route, { id: 'br1', status: 'PENDING', booking_reference: 'BK7F3K9Q2' }, 201)
      },
    },
  ])

  await fillWizard(page)

  // The review step summarises the choices before anything is sent.
  await expect(page.getByText('Monday, 14 September 2099', { exact: true })).toBeVisible()
  await expect(page.getByText('09:00–10:00')).toBeVisible()
  await expect(page.getByText('£54.85')).toBeVisible()

  await page.getByRole('button', { name: 'Submit booking request' }).click()

  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
  await expect(page.getByText(/Thanks, Oliver/)).toBeVisible()
  await expect(page.getByText('BK7F3K9Q2')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View my account' })).toHaveAttribute(
    'href',
    '/customer/account',
  )
  expect(submitted).toMatchObject({
    customer_first_name: 'Oliver',
    customer_email: 'oliver@example.com',
    vehicle_registration: 'OB08AUD',
    appointment_type_id: 'at1',
    preferred_date: BOOKING_DATE,
    preferred_time: '09:00',
  })
})

test('a booked slot cannot be chosen', async ({ page }) => {
  await stubApi(page)
  await page.goto('/book/g1')
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: /^MOT test/ }).click()

  const booked = page.getByRole('button', { name: '10:00 — Booked' })
  await expect(booked).toHaveAttribute('aria-disabled', 'true')
  // force: Playwright refuses to click a disabled control on its own; forcing
  // it proves the app itself ignores the click rather than relying on that.
  await booked.click({ force: true })
  // Still on the date & time step — no slot was taken.
  await expect(page.getByRole('heading', { name: 'Pick a date & time' })).toBeVisible()
})

test('the wizard blocks bad contact details before anything is sent', async ({ page }) => {
  await stubApi(page)
  await page.goto('/book/g1')
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('button', { name: '09:00 — Available' }).click()

  await page.getByLabel('Registration number').fill('OB08AUD')
  await page.getByLabel('First name').fill('Oliver')
  await page.getByLabel('Last name').fill('Bennett')
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByLabel('Mobile number').fill('01234 567890') // a landline
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  await expect(page.getByText(/Enter a valid UK mobile number/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review' })).toBeHidden()
})

test('a slot taken during checkout sends the customer back to pick another time', async ({ page }) => {
  await stubApi(page, [
    {
      method: 'POST',
      path: /\/booking-requests$/,
      handler: (route) => respond.apiError(route, 409, 'That time was just taken.'),
    },
  ])
  await fillWizard(page)
  await page.getByRole('button', { name: 'Submit booking request' }).click()

  await expect(page.getByText(/That time was just taken\./)).toBeVisible()
  await expect(page.getByText(/please pick another time/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pick a date & time' })).toBeVisible()
})

test('the customer can go back and correct their details without losing them', async ({ page }) => {
  await stubApi(page)
  await fillWizard(page)

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByLabel('Registration number')).toHaveValue('OB08AUD')
  await page.getByLabel('Make').fill('BMW')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('BMW')).toBeVisible()
})

test('changing the service clears the chosen time, since the duration changed', async ({ page }) => {
  await stubApi(page)
  await page.goto('/book/g1')
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('button', { name: '09:00 — Available' }).click()
  await expect(page.getByRole('heading', { name: 'Vehicle details' })).toBeVisible()

  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: /^Full service/ }).click()
  await expect(page.getByRole('button', { name: '09:00 — Available' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('a dead booking link explains itself instead of showing an empty wizard', async ({ page }) => {
  await stubApi(page, [
    {
      path: /^\/api\/public\/garages\//,
      handler: (route) => respond.apiError(route, 404, 'Not found'),
    },
  ])
  await page.goto('/book/nope')
  await expect(page.getByRole('heading', { name: 'Business not found' })).toBeVisible()
})

test('a day with no remaining times says so', async ({ page }) => {
  await stubApi(page, [
    {
      path: /\/availability\/\d{4}-\d{2}-\d{2}$/,
      handler: (route) => respond.json(route, { ...DAY_AVAILABILITY, slots: [] }),
    },
  ])
  await page.goto('/book/g1')
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: /^MOT test/ }).click()

  await expect(page.getByText(/No times are still available on this day/)).toBeVisible()
})

test('a failed availability lookup offers a retry rather than an empty calendar', async ({ page }) => {
  let attempts = 0
  await stubApi(page, [
    {
      path: /\/availability$/,
      handler: (route) => {
        attempts++
        return respond.apiError(route, 500, 'Server error')
      },
    },
  ])
  await page.goto('/book/g1')
  await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  expect(attempts).toBeGreaterThan(0)
})
