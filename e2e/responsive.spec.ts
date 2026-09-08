import { expect, test, type Page } from '@playwright/test'
import { signInAsStaff, stubApi } from './fixtures/api'

/**
 * This app has no JavaScript breakpoint logic — responsiveness is entirely
 * Tailwind's CSS grid reflow. jsdom applies no CSS, so these assertions are
 * only meaningful in a real browser, and they are deliberately *functional*
 * (nothing overflows, every control stays reachable) rather than pixel-exact.
 */
const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const

/** True if the page scrolls sideways — the classic mobile-layout failure. */
async function overflowsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
}

for (const [name, size] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} (${size.width}×${size.height})`, () => {
    test.use({ viewport: size })

    test('the booking wizard fits the viewport without sideways scrolling', async ({ page }) => {
      await stubApi(page)
      await page.goto('/book/g1')
      await expect(page.getByRole('heading', { name: 'Pick a date & time' })).toBeVisible()
      expect(await overflowsHorizontally(page)).toBe(false)
    })

    test('the customer sign-in page fits the viewport without sideways scrolling', async ({ page }) => {
      await stubApi(page)
      await page.goto('/customer/login')
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
      expect(await overflowsHorizontally(page)).toBe(false)
    })

    test('every primary nav destination stays reachable', async ({ page }) => {
      await signInAsStaff(page)
      await stubApi(page)
      await page.goto('/g1/dashboard')

      // The staff shell has no mobile treatment (see the known-limitation test
      // below), so at narrow widths these are reachable only after a sideways
      // scroll. That they remain present and clickable is what is asserted here.
      for (const label of ['Dashboard', 'Customers', 'Appointments', 'Settings']) {
        const link = page.getByRole('link', { name: label, exact: true })
        await expect(link).toBeVisible()
        // Visible is not enough: it must also be clickable at this width.
        await expect(link).toBeEnabled()
      }
      await page.getByRole('link', { name: 'Customers', exact: true }).click()
      await expect(page).toHaveURL(/\/g1\/customers$/)
    })

    test('the staff sign-in form fits the viewport and signs the user in', async ({ page }) => {
      await stubApi(page)
      await page.goto('/login')
      expect(await overflowsHorizontally(page)).toBe(false)

      await page.getByLabel('Email').fill('greg@bennett.example')
      await page.getByLabel('Password').fill('correct-horse')
      await page.getByRole('button', { name: 'Login' }).click()
      await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    })
  })
}

test.describe('known limitation: the staff shell has no narrow-viewport layout', () => {
  /**
   * The staff header renders its six nav items, the garage name and Log out in
   * one non-wrapping row, so the whole page scrolls sideways below roughly
   * 835px. There is no hamburger/drawer anywhere in the codebase.
   *
   * This is documented rather than silently fixed: giving the staff app a
   * mobile navigation is a product/design change, not a test change. The
   * assertions below pin the current boundary, so a fix (or a regression that
   * pushes the minimum wider) shows up here and gets deliberately updated.
   */
  test('the staff app lays out cleanly at desktop width', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto('/g1/dashboard')
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    expect(await overflowsHorizontally(page)).toBe(false)
  })

  test('the staff app still needs roughly 835px, and no more', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)

    await page.setViewportSize({ width: 900, height: 800 })
    await page.goto('/g1/dashboard')
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    expect(await overflowsHorizontally(page)).toBe(false)

    // Portrait tablet and below currently overflow. Change this expectation
    // (and the describe title) as part of adding a real mobile navigation.
    await page.setViewportSize(VIEWPORTS.tablet)
    await expect.poll(() => overflowsHorizontally(page)).toBe(true)
  })
})

test.describe('layout reflow between breakpoints', () => {
  test('the dashboard capacity cards stack on mobile and sit in a row on desktop', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)

    const cardsPerRow = async () => {
      const tops = await page
        .getByRole('link', { name: /booked time|Edit appointments/ })
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
      return new Set(tops).size
    }

    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto('/g1/dashboard')
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
    // Three distinct top offsets = three stacked rows.
    expect(await cardsPerRow()).toBe(3)

    await page.setViewportSize(VIEWPORTS.desktop)
    // One shared top offset = a single row.
    await expect.poll(cardsPerRow).toBe(1)
  })

  test('the booking wizard is completable on a phone', async ({ page }) => {
    // The public journey has to work on the device most customers use.
    await page.setViewportSize(VIEWPORTS.mobile)
    await stubApi(page)
    await page.goto('/book/g1')

    await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
    await page.getByRole('button', { name: /^MOT test/ }).click()
    await page.getByRole('button', { name: '09:00 — Available' }).click()

    await page.getByLabel('Registration number').fill('OB08AUD')
    await page.getByLabel('First name').fill('Oliver')
    await page.getByLabel('Last name').fill('Bennett')
    await page.getByLabel('Email').fill('oliver@example.com')
    await page.getByLabel('Mobile number').fill('07123456789')
    expect(await overflowsHorizontally(page)).toBe(false)

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Submit booking request' }).click()
    await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
  })

  test('the time-slot buttons meet the 44px touch-target minimum on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await stubApi(page)
    await page.goto('/book/g1')
    await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
    await page.getByRole('button', { name: /^MOT test/ }).click()

    const slot = page.getByRole('button', { name: '09:00 — Available' })
    const box = (await slot.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
  })
})
