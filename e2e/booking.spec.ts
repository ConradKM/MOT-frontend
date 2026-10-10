import { expect, test } from '@playwright/test'
import { respond, stubApi } from './fixtures/api'
import { BOOKING_DATE, DAY_AVAILABILITY, PUBLIC_GARAGE } from './fixtures/data'

/**
 * The public booking wizard — the only unauthenticated write path in the
 * product, and the journey with the most business value.
 */

/** Drives the wizard as far as the review step. */
async function fillWizard(page: import('@playwright/test').Page) {
  await page.goto('/book/g1')
  await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()

  // Service first: what is being booked decides which days and times are
  // even offered, so it cannot sensibly come after the calendar.
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: '09:00 — Available' }).click()

  // The wizard advances to the details step as soon as a slot is picked.
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
  await page.getByLabel('First name').fill('Oliver')
  await page.getByLabel('Last name').fill('Bennett')
  await page.getByLabel('Email').fill('oliver@example.com')
  await page.getByLabel('Mobile number').fill('07123 456789')
  // Part of this business's own configured workflow, not a built-in field.
  await page.getByLabel('Registration number').fill('OB08AUD')
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

  await page.getByRole('button', { name: 'Confirm Booking' }).click()

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
    appointment_type_id: 'at1',
    preferred_date: BOOKING_DATE,
    preferred_time: '09:00',
    // The configured field travels as an answer, keyed by field id.
    answers: [{ field_id: 'fld-reg', value: 'OB08AUD' }],
  })
})

test('a booked slot cannot be chosen', async ({ page }) => {
  await stubApi(page)
  await page.goto('/book/g1')
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()

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
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
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
  await page.getByRole('button', { name: 'Confirm Booking' }).click()

  await expect(page.getByText(/That time was just taken\./)).toBeVisible()
  await expect(page.getByText(/please pick another time/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pick a date & time' })).toBeVisible()
})

test('the customer can go back and correct their details without losing them', async ({ page }) => {
  await stubApi(page)
  await fillWizard(page)

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByLabel('Registration number')).toHaveValue('OB08AUD')
  await page.getByLabel('Registration number').fill('BM70WXY')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('BM70WXY')).toBeVisible()
})

test('changing the service clears the chosen time, since the duration changed', async ({ page }) => {
  await stubApi(page)
  await page.goto('/book/g1')
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: '09:00 — Available' }).click()
  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()

  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Change' }).click()
  await page.getByRole('button', { name: /^Full service/ }).click()

  // Back on the calendar with nothing picked: a different duration means
  // different days and times are available, so the old choice cannot stand.
  await expect(page.getByRole('heading', { name: 'Pick a date & time' })).toBeVisible()
  await expect(page.getByRole('button', { name: '09:00 — Available' })).toBeHidden()
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
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()

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
  await page.getByRole('button', { name: /^MOT test/ }).click()
  await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
  expect(attempts).toBeGreaterThan(0)
})

test('a customer adds extras, sees the price and finish time change, and books them', async ({ page }) => {
  const garageWithAddOns = {
    ...PUBLIC_GARAGE,
    appointment_types: PUBLIC_GARAGE.appointment_types.map((t) =>
      t.id !== 'at1'
        ? t
        : {
            ...t,
            add_ons: [
              {
                id: 'ao-tyre',
                name: 'Tyre check',
                description: null,
                price_delta: '15.00',
                duration_delta_minutes: 30,
                max_quantity: 1,
                exclusivity_group: null,
              },
              {
                id: 'ao-rush',
                name: 'Rush job',
                description: null,
                price_delta: '20.00',
                duration_delta_minutes: -15,
                max_quantity: 1,
                exclusivity_group: 'Turnaround',
              },
              {
                id: 'ao-std',
                name: 'Standard',
                description: null,
                price_delta: '0.00',
                duration_delta_minutes: 0,
                max_quantity: 1,
                exclusivity_group: 'Turnaround',
              },
            ],
          },
    ),
  }
  const availabilityQueries: string[] = []
  let submitted: Record<string, unknown> = {}
  await stubApi(page, [
    { path: /^\/api\/public\/garages\/[^/]+$/, handler: (route) => respond.json(route, garageWithAddOns) },
    {
      path: /\/availability\/\d{4}-\d{2}-\d{2}$/,
      handler: (route, url) => {
        availabilityQueries.push(url.searchParams.get('add_ons') ?? '')
        return respond.json(route, DAY_AVAILABILITY)
      },
    },
    {
      method: 'POST',
      path: /\/booking-requests$/,
      handler: async (route) => {
        submitted = JSON.parse(route.request().postData() ?? '{}')
        return respond.json(route, { id: 'br1', status: 'PENDING', booking_reference: 'BK7F3K9Q2' }, 201)
      },
    },
  ])

  await page.goto('/book/g1')
  await page.getByRole('button', { name: /^MOT test/ }).click()

  // Extras are chosen before the calendar, because they change the job's length.
  const total = page.getByTestId('service-add-on-total')
  await expect(total).toContainText('£54.85')
  await page.getByRole('button', { name: /Add extras to MOT test/ }).click()
  await page.getByRole('checkbox', { name: /Tyre check/ }).click()
  await page.getByRole('radio', { name: /Standard/ }).click()
  await page.getByRole('radio', { name: /Rush job/ }).click()
  // One per group: picking Rush job cleared Standard.
  await expect(page.getByRole('radio', { name: /Standard/ })).not.toBeChecked()
  await expect(total).toContainText('£89.85')
  await expect(total).toContainText('about 1 h 15 min')
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
  await page.getByRole('button', { name: '09:00 — Available' }).click()
  expect(availabilityQueries.at(-1)).toBe('ao-rush:1,ao-tyre:1')

  await page.getByLabel('First name').fill('Oliver')
  await page.getByLabel('Last name').fill('Bennett')
  await page.getByLabel('Email').fill('oliver@example.com')
  await page.getByLabel('Mobile number').fill('07123 456789')
  await page.getByLabel('Registration number').fill('OB08AUD')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  await expect(page.getByText('Tyre check, Rush job')).toBeVisible()
  await expect(page.getByText('£89.85')).toBeVisible()
  await expect(page.getByText('09:00–10:15')).toBeVisible()

  await page.getByRole('button', { name: 'Confirm Booking' }).click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
  expect(submitted).toMatchObject({
    appointment_type_id: 'at1',
    add_ons: [
      { add_on_id: 'ao-tyre', quantity: 1 },
      { add_on_id: 'ao-rush', quantity: 1 },
    ],
  })
})

test('a customer reads and accepts the business terms before booking', async ({ page }) => {
  const terms = '1. Deposits are non-refundable.\n2. Please arrive 10 minutes early.'
  let submitted: Record<string, unknown> = {}
  await stubApi(page, [
    {
      path: /^\/api\/public\/(garages\/g1|bennett-motors)$/,
      handler: (route) =>
        respond.json(route, { ...PUBLIC_GARAGE, terms_and_conditions: terms, terms_version: 3 }),
    },
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

  // Not bookable until the terms are accepted - and trying says why.
  const confirm = page.getByRole('button', { name: 'Confirm Booking' })
  await expect(confirm).toHaveAttribute('aria-disabled', 'true')
  // aria-disabled, not disabled: it stays clickable so a customer who tries
  // is told why. Playwright won't click aria-disabled controls unforced.
  await confirm.click({ force: true })
  await expect(page.getByText('Please accept the terms and conditions to continue.')).toBeVisible()

  // The terms open in a popup whose text scrolls on its own, with Accept
  // always reachable below it.
  await page.getByRole('button', { name: 'terms and conditions' }).click()
  const dialog = page.getByRole('dialog', { name: 'Terms and conditions' })
  await expect(dialog).toBeVisible()
  const text = dialog.getByRole('region', { name: 'Terms and conditions text' })
  await expect(text).toContainText('Please arrive 10 minutes early.')
  await expect(text).toBeFocused()
  await dialog.getByRole('button', { name: 'Accept' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('checkbox', { name: /I have read and accept the/ })).toBeChecked()
  // The public booking layout links the same terms in its footer.
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Terms & Conditions' }))
    .toHaveAttribute('href', '/terms/g1')

  await confirm.click()
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
  expect(submitted).toMatchObject({ terms_accepted: true, terms_version: 3 })
})
