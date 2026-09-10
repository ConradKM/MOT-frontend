import { expect, test } from '@playwright/test'
import { respond, signInAsStaff, stubApi } from './fixtures/api'

test.describe('staff navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)
  })

  test('moves between the primary sections through the nav', async ({ page }) => {
    await page.goto('/g1/dashboard')
    await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()

    for (const [link, heading, url] of [
      ['Customers', 'Customers', '/g1/customers'],
      ['Appointments', 'Appointments', '/g1/appointments'],
      ['Requests', 'Booking requests', '/g1/booking-requests'],
      ['Settings', 'Settings', '/g1/settings'],
    ] as const) {
      await page.getByRole('link', { name: link, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${url}$`))
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    }
  })

  test('marks the current section in the nav', async ({ page }) => {
    await page.goto('/g1/customers')
    await expect(page.getByRole('link', { name: 'Customers', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('the browser back and forward buttons move through the app’s history', async ({ page }) => {
    await page.goto('/g1/dashboard')
    await page.getByRole('link', { name: 'Customers', exact: true }).click()
    await expect(page).toHaveURL(/\/g1\/customers$/)

    await page.goBack()
    await expect(page).toHaveURL(/\/g1\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()

    await page.goForward()
    await expect(page).toHaveURL(/\/g1\/customers$/)
  })

  test('drills from a list into a record and back', async ({ page }) => {
    await page.goto('/g1/customers')
    await page.getByRole('link', { name: 'Oliver Bennett' }).click()
    await expect(page).toHaveURL(/\/g1\/customers\/c1$/)
    await expect(page.getByRole('heading', { name: 'Oliver Bennett' })).toBeVisible()

    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Customers', level: 1 })).toBeVisible()
  })

  test('a deep link is reachable directly, not only by clicking through', async ({ page }) => {
    await page.goto('/g1/vehicles/v1')
    await expect(page.getByRole('heading', { name: 'OB08AUD' })).toBeVisible()
  })

  test('an unknown URL falls back to the booking entry point', async ({ page }) => {
    await page.goto('/no/such/page')
    await expect(page.getByRole('heading', { name: 'Booking link needed' })).toBeVisible()
  })

  test('the platform footer is present on every layout', async ({ page }) => {
    await page.goto('/g1/dashboard')
    await expect(page.getByText('Powered by CoMaz OS™')).toBeVisible()
  })
})

test.describe('search and filtering', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page)
  })

  test('filtering the vehicle list narrows the results, and clearing restores them', async ({ page }) => {
    await stubApi(page, [
      {
        path: '/api/vehicles/',
        handler: (route, url) =>
          respond.json(
            route,
            url.searchParams.get('registration') === 'ZZ99'
              ? []
              : [
                  {
                    id: 'v1',
                    garage_id: 'g1',
                    customer_id: 'c1',
                    registration_number: 'OB08AUD',
                    make: 'Audi',
                    model: 'A4',
                    year: 2018,
                    current_mileage: 40000,
                    mot_expiry_date: '2027-08-12',
                    is_active: true,
                    created_at: '',
                    updated_at: '',
                  },
                ],
          ),
      },
    ])
    await page.goto('/g1/vehicles')
    await expect(page.getByRole('link', { name: 'OB08AUD' })).toBeVisible()

    await page.getByPlaceholder('Registration…').fill('ZZ99')
    await expect(page.getByText('No vehicles found.')).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByRole('link', { name: 'OB08AUD' })).toBeVisible()
  })

  test('searching customers filters the table as the user types', async ({ page }) => {
    await stubApi(page)
    await page.goto('/g1/customers')
    await expect(page.getByRole('link', { name: 'Oliver Bennett' })).toBeVisible()

    await page.getByPlaceholder(/Search name, email/).fill('nadia')
    await expect(page.getByRole('link', { name: 'Nadia Okafor' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Oliver Bennett' })).toBeHidden()
  })
})
