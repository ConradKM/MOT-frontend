import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { respond, stubApi, themedGarage } from './fixtures/api'
import { chooseMotTest } from './fixtures/booking'
import { DAY_AVAILABILITY } from './fixtures/data'

/**
 * The booking wizard's summary overlay and Date & time layout - the parts
 * that only real CSS can prove: what sits beside what, what covers what, and
 * what animates.
 */

async function pickMotTest(page: Page) {
  await page.getByRole('button', { name: /^Testing & servicing/ }).click()
  await page.getByRole('button', { name: /^MOT test/ }).click()
}

/** A 4-hour job, with the server's own end times. */
const LONG_DAY = {
  ...DAY_AVAILABILITY,
  duration_minutes: 240,
  slots: [
    { start: '09:00', end: '13:00', duration_minutes: 240, status: 'booked', remaining: 0, capacity: 1 },
    { start: '10:00', end: '14:00', duration_minutes: 240, status: 'available', remaining: 1, capacity: 1 },
    { start: '13:00', end: '17:00', duration_minutes: 240, status: 'available', remaining: 1, capacity: 1 },
  ],
}

test('the overlay appears on picking a service, and its Next is the only way on', async ({ page }) => {
  await stubApi(page)
  await page.goto('/book/g1')
  await expect(page.getByRole('heading', { name: 'What would you like to book?' })).toBeVisible()
  await expect(page.getByTestId('booking-summary-overlay')).toBeHidden()

  await pickMotTest(page)
  const overlay = page.getByRole('region', { name: 'MOT test' })
  await expect(overlay).toBeVisible()
  await expect(overlay.getByTestId('summary-price')).toHaveText('£54.85')
  await expect(overlay.getByTestId('summary-time')).toHaveText('1 h')
  // Still on the service step, and there is no other button forward.
  await expect(page.getByRole('heading', { name: 'What would you like to book?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0)

  const next = overlay.getByRole('button', { name: 'Next' })
  const box = (await next.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  await next.click()
  await expect(page.getByRole('heading', { name: 'Pick a date & time' })).toBeVisible()
  await expect(page.getByTestId('booking-summary-overlay')).toBeHidden()
})

test('the overlay never hides the last service', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 640 })
  await stubApi(page)
  await page.goto('/book/g1')
  await pickMotTest(page)
  const overlay = page.getByTestId('booking-summary-overlay')
  await expect(overlay).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const last = page.getByRole('button', { name: /^Full service/ })
  const lastBox = (await last.boundingBox())!
  const overlayBox = (await overlay.boundingBox())!
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(overlayBox.y)
})

test('reduced motion: the overlay arrives without animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await stubApi(page)
  await page.goto('/book/g1')
  await pickMotTest(page)

  const overlay = page.getByTestId('booking-summary-overlay')
  await expect(overlay).toBeVisible()
  expect(await overlay.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  await overlay.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: 'Pick a date & time' })).toBeVisible()
})

test('the service step with the overlay open is accessible on a themed page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await stubApi(page, themedGarage('dark'))
  await page.goto('/book/g1')
  await expect(page.locator('[data-booking-theme="custom"]')).toBeVisible()
  await pickMotTest(page)
  await expect(page.getByTestId('booking-summary-overlay')).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('[data-testid="booking-summary-overlay"]')
    .analyze()
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
})

test.describe('wide screens (1280px)', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('times sit beside the calendar, with a placeholder until a day is picked', async ({ page }) => {
    await stubApi(page)
    await page.goto('/book/g1')
    await chooseMotTest(page)

    const calendar = page.getByRole('grid')
    const placeholder = page.getByTestId('times-placeholder')
    await expect(placeholder).toBeVisible()
    await expect(placeholder).toContainText('Pick a day to see available times')
    const cal = (await calendar.boundingBox())!
    const ph = (await placeholder.boundingBox())!
    expect(ph.x).toBeGreaterThanOrEqual(cal.x + cal.width)
    expect(Math.abs(ph.y - cal.y)).toBeLessThan(cal.height)

    await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
    const times = page.getByRole('heading', { name: /Times for/ })
    await expect(times).toBeVisible()
    await expect(placeholder).toBeHidden()
    expect((await times.boundingBox())!.x).toBeGreaterThanOrEqual(cal.x + cal.width)
  })
})

test.describe('phones (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('times stack under the calendar and there is no placeholder', async ({ page }) => {
    await stubApi(page)
    await page.goto('/book/g1')
    await chooseMotTest(page)

    await expect(page.getByRole('grid')).toBeVisible()
    await expect(page.getByTestId('times-placeholder')).toBeHidden()

    await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
    const times = page.getByRole('heading', { name: /Times for/ })
    await expect(times).toBeInViewport()
    const cal = (await page.getByRole('grid').boundingBox())!
    expect((await times.boundingBox())!.y).toBeGreaterThan(cal.y + cal.height)
  })
})

test('a long appointment shows its whole span, and a taken span sends the customer back', async ({
  page,
}) => {
  await stubApi(page, [
    { path: /\/availability\/\d{4}-\d{2}-\d{2}$/, handler: (route) => respond.json(route, LONG_DAY) },
    {
      method: 'POST',
      path: /\/booking-requests$/,
      handler: (route) => respond.apiError(route, 409, 'This time is no longer available.'),
    },
  ])
  await page.goto('/book/g1')
  await chooseMotTest(page)
  await page.getByRole('gridcell', { name: /14 September 2099/ }).click()

  await expect(page.getByText('Appointment length: 4 h')).toBeVisible()
  await expect(page.getByRole('button', { name: '09:00 to 13:00, Booked' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  const slot = page.getByRole('button', { name: '10:00 to 14:00, Available' })
  await expect(slot).toContainText('10:00 - 14:00')
  await slot.click()

  await expect(page.getByText(/10:00 - 14:00/)).toBeVisible() // the selected-slot banner
  await page.getByLabel('First name').fill('Oliver')
  await page.getByLabel('Last name').fill('Bennett')
  await page.getByLabel('Email').fill('oliver@example.com')
  await page.getByLabel('Mobile number').fill('07123 456789')
  await page.getByLabel('Registration number').fill('OB08AUD')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
  await expect(page.getByText('10:00 - 14:00', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Confirm Booking' }).click()
  await expect(page.getByText(/This time is no longer available\./)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pick a date & time' })).toBeVisible()
})
