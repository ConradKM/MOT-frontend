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

const NAV_LABELS = [
  'Dashboard',
  'Customers',
  'Appointments',
  'Requests',
  'Queue',
  'Payments',
  'Communications',
  'Settings',
]

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
      // The service step is what a customer lands on, and it is the widest
      // thing the wizard renders - grid cards in particular.
      await expect(page.getByRole('heading', { name: 'What would you like to book?' })).toBeVisible()
      expect(await overflowsHorizontally(page)).toBe(false)

      await page.getByRole('button', { name: /^MOT test/ }).click()
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
      await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()
      expect(await overflowsHorizontally(page)).toBe(false)

      // Below `sm:` the sections live behind the menu button; from `sm:` up
      // they are all inline (scrolling within the nav row if it's too narrow).
      const phone = size.width < 640
      await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible({ visible: phone })
      if (phone) await page.getByRole('button', { name: 'Menu' }).click()
      const nav = page.getByRole('navigation', { name: phone ? 'Main menu' : 'Main' })

      for (const label of NAV_LABELS) {
        const link = nav.getByRole('link', { name: label, exact: true })
        await link.scrollIntoViewIfNeeded()
        await expect(link).toBeVisible()
        await expect(link).toBeEnabled()
      }
      await nav.getByRole('link', { name: 'Customers', exact: true }).click()
      await expect(page).toHaveURL(/\/g1\/customers$/)
    })

    test('the staff sign-in form fits the viewport and signs the user in', async ({ page }) => {
      await stubApi(page)
      await page.goto('/login')
      expect(await overflowsHorizontally(page)).toBe(false)

      await page.getByLabel('Email').fill('greg@bennett.example')
      await page.getByLabel('Password').fill('correct-horse')
      await page.getByRole('button', { name: 'Login' }).click()
      await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()
    })
  })
}

test.describe('staff shell navigation across widths', () => {
  /**
   * Below `sm:` (640px) the header is just the business name and a menu
   * button; from `sm:` up every section is inline. Between `sm:` and ~1280px
   * the inline row is wider than its slot, so it scrolls sideways *within
   * itself* — the page as a whole must never scroll sideways at any width.
   */
  test('the page never scrolls sideways, from phone to desktop', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto('/g1/dashboard')
    await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()

    for (const width of [320, 375, 639, 640, 700, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await expect.poll(() => overflowsHorizontally(page), { message: `at ${width}px` }).toBe(false)
    }
  })

  test('at desktop width every section fits inline without scrolling the nav', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)
    await page.setViewportSize(VIEWPORTS.desktop)
    await page.goto('/g1/dashboard')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()
    const scrolls = await nav.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(scrolls).toBe(false)
  })

  test('on a phone the menu opens, navigates, and closes itself', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto('/g1/dashboard')
    await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()

    // The inline nav and header actions are hidden by CSS at this width.
    await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeHidden()
    const button = page.getByRole('button', { name: 'Menu' })
    await expect(button).toHaveAttribute('aria-expanded', 'false')

    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    const panel = page.locator('#staff-nav-menu')
    await expect(panel.getByRole('button', { name: 'Need Help?' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Log out' })).toBeVisible()
    expect(await overflowsHorizontally(page)).toBe(false)

    await panel.getByRole('link', { name: 'Queue', exact: true }).click()
    await expect(page).toHaveURL(/\/g1\/queue$/)
    await expect(panel).toBeHidden()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
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
    await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()
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

    await page.getByRole('button', { name: /^MOT test/ }).click()
    await page.getByRole('gridcell', { name: /14 September 2099/ }).click()
    await page.getByRole('button', { name: '09:00 — Available' }).click()

    await page.getByLabel('First name').fill('Oliver')
    await page.getByLabel('Last name').fill('Bennett')
    await page.getByLabel('Email').fill('oliver@example.com')
    await page.getByLabel('Mobile number').fill('07123456789')
    await page.getByLabel('Registration number').fill('OB08AUD')
    expect(await overflowsHorizontally(page)).toBe(false)

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Confirm Booking' }).click()
    await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
  })

  test('the time-slot buttons meet the 44px touch-target minimum on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await stubApi(page)
    await page.goto('/book/g1')
    await page.getByRole('button', { name: /^MOT test/ }).click()
    await page.getByRole('gridcell', { name: /14 September 2099/ }).click()

    const slot = page.getByRole('button', { name: '09:00 — Available' })
    const box = (await slot.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
  })
})
