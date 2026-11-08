import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { BASIC_INSIGHTS, INSIGHTS } from './fixtures/data'
import { signInAsStaff, stubApi, type Override } from './fixtures/api'

const json = (body: unknown) => (route: import('@playwright/test').Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

/** The signed-in employee (e1) is the business's OWNER. */
const OWNER: Override = {
  path: '/api/employees/',
  handler: json([
    {
      id: 'e1',
      garage_id: 'g1',
      email: 'greg@bennett.example',
      first_name: 'Greg',
      last_name: 'Mason',
      is_active: true,
      roles: [{ id: 'r1', garage_id: 'g1', name: 'OWNER', created_at: '', updated_at: '' }],
      created_at: '',
      updated_at: '',
    },
  ]),
}

async function overflowsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 375, height: 812 },
} as const

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`insights on ${name}`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await signInAsStaff(page)
    })

    test('an owner on PRO sees money, every panel and the due-back list', async ({ page }) => {
      await stubApi(page, [OWNER, { path: '/api/insights', handler: json(INSIGHTS) }])
      await page.goto('/g1/insights')

      await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible()
      await expect(page.getByRole('group', { name: 'Booked value' })).toContainText('£80.00')
      await expect(page.getByRole('group', { name: 'Booked value' })).toContainText('+100% vs previous 31 days')
      for (const panel of ['Trend', 'Top services', 'Busy days and times', 'Staff', 'Customers']) {
        await expect(page.getByRole('heading', { name: panel, exact: true })).toBeVisible()
      }
      // The chart is drawn (Recharts, lazy-loaded) and has a table twin.
      await expect(page.locator('.recharts-responsive-container')).toBeVisible()
      await page.getByText('Show as a table').click()
      await expect(page.getByRole('table', { name: 'Appointments per day' })).toBeVisible()

      const bookIn = page.getByRole('link', { name: 'Book in Jane Smith' })
      await bookIn.scrollIntoViewIfNeeded()
      await expect(bookIn).toHaveAttribute('href', '/g1/appointments/new?customer_id=c1')
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible()
      expect(await overflowsHorizontally(page)).toBe(false)
    })

    test('a basic plan shows the upsell in place of advanced panels', async ({ page }) => {
      await stubApi(page, [OWNER, { path: '/api/insights', handler: json(BASIC_INSIGHTS) }])
      await page.goto('/g1/insights')

      await expect(page.getByRole('heading', { name: 'Top services' })).toBeVisible()
      await expect(page.getByText('Not on your plan')).toHaveCount(4)
      await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0)
      expect(await overflowsHorizontally(page)).toBe(false)
    })
  })
}

test('the booking wizard never downloads the chart library', async ({ page }) => {
  const chunks: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') chunks.push(request.url())
  })
  await stubApi(page)
  await page.goto('/book/bennett-motors')
  await page.waitForLoadState('networkidle')

  expect(chunks.some((url) => /TrendChart|recharts/i.test(url))).toBe(false)
})

test('the Insights page has no detectable accessibility violations', async ({ page }) => {
  await signInAsStaff(page)
  await stubApi(page, [OWNER, { path: '/api/insights', handler: json(INSIGHTS) }])
  await page.goto('/g1/insights')
  await expect(page.locator('.recharts-responsive-container')).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(['color-contrast'])
    .analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
})
