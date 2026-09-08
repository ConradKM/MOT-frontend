import { expect, test } from '@playwright/test'
import { respond, signInAsStaff, stubApi } from './fixtures/api'

/**
 * What a user actually sees for each way the backend can fail. Every case is
 * produced by the stub layer — no real server is involved in any of it.
 */
test.describe('backend failures', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page)
  })

  for (const status of [400, 403, 404, 500, 503] as const) {
    test(`a ${status} on the vehicle list shows an error, not a blank page`, async ({ page }) => {
      await stubApi(page, [
        { path: '/api/vehicles/', handler: (route) => respond.apiError(route, status, 'Nope') },
      ])
      await page.goto('/g1/vehicles')
      await expect(page.getByText('Failed to load vehicles.')).toBeVisible()
      // The surrounding app chrome must survive one failing query.
      await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()
    })
  }

  test('a dropped connection shows an error rather than an endless spinner', async ({ page }) => {
    await stubApi(page, [{ path: '/api/vehicles/', handler: (route) => route.abort('failed') }])
    await page.goto('/g1/vehicles')
    await expect(page.getByText('Failed to load vehicles.')).toBeVisible()
  })

  test('a malformed response shows an error rather than crashing the page', async ({ page }) => {
    await stubApi(page, [
      {
        path: '/api/vehicles/',
        handler: (route) =>
          route.fulfill({ status: 200, contentType: 'text/html', body: '<html>oops</html>' }),
      },
    ])
    await page.goto('/g1/vehicles')
    await expect(page.getByText('Failed to load vehicles.')).toBeVisible()
  })

  test('a slow response shows a loading state first, then the data', async ({ page }) => {
    await stubApi(page, [
      {
        path: '/api/vehicles/',
        handler: async (route) => {
          await new Promise((r) => setTimeout(r, 1200))
          return respond.json(route, [])
        },
      },
    ])
    await page.goto('/g1/vehicles')
    await expect(page.getByText('Loading…')).toBeVisible()
    await expect(page.getByText('No vehicles found.')).toBeVisible()
  })

  test('an empty dataset is explained rather than shown as an empty table', async ({ page }) => {
    await stubApi(page, [
      { path: '/api/vehicles/', handler: (route) => respond.json(route, []) },
      { path: '/api/customers/', handler: (route) => respond.json(route, []) },
      { path: '/api/appointments/', handler: (route) => respond.json(route, []) },
    ])
    await page.goto('/g1/vehicles')
    await expect(page.getByText('No vehicles found.')).toBeVisible()

    await page.goto('/g1/dashboard')
    await expect(page.getByText('Nothing booked for today.')).toBeVisible()
  })

  test('a 401 that can be refreshed is retried transparently, with no visible error', async ({ page }) => {
    // The silent-refresh path: the user should never notice their access token
    // expired mid-session.
    let attempts = 0
    await stubApi(page, [
      {
        path: '/api/vehicles/',
        handler: (route) => {
          attempts++
          return attempts === 1
            ? respond.apiError(route, 401, 'Token has expired')
            : respond.json(route, [])
        },
      },
    ])
    await page.goto('/g1/vehicles')
    await expect(page.getByText('No vehicles found.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeHidden()
    expect(attempts).toBe(2)
  })

  test('a rejected save keeps the user on the form with their input intact', async ({ page }) => {
    await stubApi(page, [
      {
        method: 'POST',
        path: '/api/customers/',
        handler: (route) =>
          route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 422,
              status: 'Unprocessable Entity',
              errors: { json: { email: ['Not a valid email address.'] } },
            }),
          }),
      },
    ])
    await page.goto('/g1/customers/new')
    await page.getByLabel('First name').fill('Oliver')
    await page.getByLabel('Last name').fill('Bennett')
    await page.getByLabel('Phone').fill('07123456789')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Not a valid email address.')).toBeVisible()
    await expect(page.getByLabel('First name')).toHaveValue('Oliver')
    await expect(page).toHaveURL(/\/customers\/new$/)
  })

  test('rapid repeated clicks create exactly one record', async ({ page }) => {
    let posts = 0
    await stubApi(page, [
      {
        method: 'POST',
        path: '/api/customers/',
        handler: async (route) => {
          posts++
          await new Promise((r) => setTimeout(r, 400))
          return respond.json(route, { id: 'c9' })
        },
      },
    ])
    await page.goto('/g1/customers/new')
    await page.getByLabel('First name').fill('Oliver')
    await page.getByLabel('Last name').fill('Bennett')

    // Three real clicks in quick succession at the same spot — what an
    // impatient user does. Driven through page.mouse rather than
    // locator.click() so no actionability wait separates them.
    const box = (await page.getByRole('button', { name: 'Save' }).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    for (let i = 0; i < 3; i++) {
      await page.mouse.down()
      await page.mouse.up()
    }

    await expect(page.getByText('Customer created.')).toBeVisible()
    expect(posts).toBe(1)
  })
})
