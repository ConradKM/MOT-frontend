import { expect, test } from '@playwright/test'
import { respond, signInAsCustomer, signInAsStaff, stubApi } from './fixtures/api'

test.describe('staff authentication', () => {
  test('signs in and lands on the garage dashboard', async ({ page }) => {
    await stubApi(page)
    await page.goto('/login')

    await page.getByLabel('Email').fill('greg@bennett.example')
    await page.getByLabel('Password').fill('correct-horse')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByRole('heading', { name: 'Welcome, Bennett Motors' })).toBeVisible()
    // /dashboard resolves to the employee's own garage-scoped URL.
    await expect(page).toHaveURL(/\/g1\/dashboard$/)
  })

  test('shows a rejection and stays on the form for bad credentials', async ({ page }) => {
    await stubApi(page, [
      {
        method: 'POST',
        path: '/api/auth/login',
        handler: (route) => respond.apiError(route, 401, 'Incorrect email or password.'),
      },
    ])
    await page.goto('/login')
    await page.getByLabel('Email').fill('greg@bennett.example')
    await page.getByLabel('Password').fill('wrong')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByText('Incorrect email or password.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('mot_access_token'))).toBeNull()
  })

  test('the browser blocks an empty submission before any request is sent', async ({ page }) => {
    let logins = 0
    await stubApi(page, [
      {
        method: 'POST',
        path: '/api/auth/login',
        handler: (route) => {
          logins++
          return respond.json(route, {})
        },
      },
    ])
    await page.goto('/login')
    await page.getByRole('button', { name: 'Login' }).click()

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(logins).toBe(0)
  })

  test('the browser enforces the 8-character minimum password on registration', async ({ page }) => {
    // jsdom implements no `tooShort` validity state, so this constraint can
    // only be observed in a real browser.
    let registrations = 0
    await stubApi(page, [
      {
        method: 'POST',
        path: '/api/auth/register',
        handler: (route) => {
          registrations++
          return respond.json(route, {})
        },
      },
    ])
    await page.goto('/register')
    await page.getByLabel('Business name').fill('Bennett Motors')
    await page.getByLabel('Owner email').fill('greg@bennett.example')
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: 'Create business' }).click()

    expect(registrations).toBe(0)
    expect(
      await page.getByLabel('Password').evaluate((el: HTMLInputElement) => el.validity.tooShort),
    ).toBe(true)
  })

  test('signs out and returns to sign-in, clearing the session', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)
    await page.goto('/g1/dashboard')
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()

    await page.getByRole('button', { name: 'Log out' }).click()

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('mot_access_token'))).toBeNull()
  })
})

test.describe('protected areas', () => {
  for (const route of ['/g1/dashboard', '/g1/customers', '/g1/settings', '/dashboard']) {
    test(`a signed-out visitor is redirected away from ${route}`, async ({ page }) => {
      await stubApi(page)
      await page.goto(route)
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    })
  }

  test('an expired session that cannot be refreshed drops the user back to sign-in', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page, [
      { path: /^\/api\//, handler: (route) => respond.apiError(route, 401, 'Token has expired') },
    ])
    await page.goto('/g1/customers')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('a stale garage id in the URL is corrected to the signed-in garage', async ({ page }) => {
    await signInAsStaff(page)
    await stubApi(page)
    await page.goto('/some-other-garage/customers')
    await expect(page).toHaveURL(/\/g1\/customers$/)
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible()
  })
})

test.describe('the customer portal', () => {
  test('signs in with an email and vehicle registration', async ({ page }) => {
    await stubApi(page, [
      {
        path: '/api/customer/account',
        handler: (route) =>
          respond.json(route, {
            customer: { first_name: 'Oliver', garage_name: 'Bennett Motors' },
            vehicles: [],
            appointments: [],
          }),
      },
    ])
    await page.goto('/customer/login')
    await page.getByLabel('Email').fill('oliver@example.com')
    await page.getByLabel('Vehicle registration').fill('ob08aud')
    // Normalised to upper case as it is typed.
    await expect(page.getByLabel('Vehicle registration')).toHaveValue('OB08AUD')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('heading', { name: 'Hi Oliver' })).toBeVisible()
  })

  test('a signed-out visitor cannot reach the account hub', async ({ page }) => {
    await stubApi(page)
    await page.goto('/customer/account')
    await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible()
  })

  test('a staff session does not unlock the customer portal', async ({ page }) => {
    // The two sessions live under separate storage keys and must stay separate.
    await signInAsStaff(page)
    await stubApi(page)
    await page.goto('/customer/account')
    await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible()
  })

  test('a customer session does not unlock the staff app', async ({ page }) => {
    await signInAsCustomer(page)
    await stubApi(page)
    await page.goto('/g1/dashboard')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })
})
