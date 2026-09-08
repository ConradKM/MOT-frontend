import type { Page, Route } from '@playwright/test'
import {
  APPOINTMENT_TYPES,
  AVAILABILITY,
  CAPACITY,
  CUSTOMERS,
  DAY_AVAILABILITY,
  GARAGE,
  PUBLIC_GARAGE,
  VEHICLES,
  jwt,
} from './data'

type Handler = (route: Route, url: URL) => unknown | Promise<unknown>

/** Matched in order; the first entry whose predicate matches wins, so a test's
 * own override (registered via `stubApi(page, { ... })`) always takes
 * precedence over the defaults below. */
interface Stub {
  method?: string
  match: (url: URL) => boolean
  handler: Handler
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const apiError = (route: Route, status: number, message: string) =>
  json(route, { code: status, status: 'Error', message }, status)

export const respond = { json, apiError }

function defaults(): Stub[] {
  return [
    // auth
    { method: 'POST', match: (u) => u.pathname === '/api/auth/login', handler: (r) => json(r, { access_token: jwt(), refresh_token: jwt() }) },
    { method: 'POST', match: (u) => u.pathname === '/api/auth/register', handler: (r) => json(r, { access_token: jwt(), refresh_token: jwt() }) },
    { method: 'POST', match: (u) => u.pathname === '/api/auth/refresh', handler: (r) => json(r, { access_token: jwt() }) },
    { method: 'POST', match: (u) => u.pathname === '/api/customer/auth/login', handler: (r) => json(r, { access_token: jwt('c1'), refresh_token: jwt('c1') }) },

    // staff app
    { match: (u) => u.pathname === '/api/garage', handler: (r) => json(r, GARAGE) },
    { match: (u) => u.pathname === '/api/garage/capacity/summary', handler: (r) => json(r, CAPACITY) },
    { match: (u) => u.pathname === '/api/customers/', handler: (r) => json(r, CUSTOMERS) },
    { match: (u) => u.pathname === '/api/vehicles/', handler: (r) => json(r, VEHICLES) },
    // Per-record detail routes, so a deep link works without a bespoke stub.
    {
      match: (u) => /^\/api\/customers\/[^/]+$/.test(u.pathname),
      handler: (r, u) => {
        const found = CUSTOMERS.find((c) => c.id === u.pathname.split('/').pop())
        return found ? json(r, found) : apiError(r, 404, 'Customer not found')
      },
    },
    { match: (u) => /\/mot-records\/$/.test(u.pathname), handler: (r) => json(r, []) },
    {
      match: (u) => /^\/api\/vehicles\/[^/]+$/.test(u.pathname),
      handler: (r, u) => {
        const found = VEHICLES.find((v) => v.id === u.pathname.split('/').pop())
        return found ? json(r, found) : apiError(r, 404, 'Vehicle not found')
      },
    },
    {
      match: (u) => /^\/api\/customers\/[^/]+\/communications$/.test(u.pathname),
      handler: (r) => json(r, []),
    },
    { match: (u) => u.pathname === '/api/appointment-types/', handler: (r) => json(r, APPOINTMENT_TYPES) },
    { match: (u) => u.pathname === '/api/appointment-statuses/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/appointments/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/employees/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/booking-requests/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/mot-reminders/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/communications/unread-count', handler: (r) => json(r, { whatsapp_unread: 0 }) },

    // public booking
    { match: (u) => /^\/api\/public\/garages\/[^/]+$/.test(u.pathname), handler: (r) => json(r, PUBLIC_GARAGE) },
    { match: (u) => u.pathname.endsWith('/availability'), handler: (r) => json(r, AVAILABILITY) },
    { match: (u) => /\/availability\/\d{4}-\d{2}-\d{2}$/.test(u.pathname), handler: (r) => json(r, DAY_AVAILABILITY) },
    { method: 'POST', match: (u) => u.pathname.endsWith('/booking-requests'), handler: (r) => json(r, { id: 'br1', status: 'PENDING' }, 201) },
  ]
}

export interface Override {
  method?: string
  /** Matched against the request's path (and query), e.g. '/api/auth/login'. */
  path: string | RegExp
  handler: Handler
}

/**
 * Intercepts every /api/** request the page makes. Anything not matched is
 * failed rather than allowed through, so a test can never silently depend on
 * a real backend.
 */
export async function stubApi(page: Page, overrides: Override[] = []): Promise<void> {
  const stubs: Stub[] = [
    ...overrides.map((o) => ({
      method: o.method,
      match: (u: URL) =>
        typeof o.path === 'string' ? u.pathname === o.path : o.path.test(u.pathname),
      handler: o.handler,
    })),
    ...defaults(),
  ]

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const stub = stubs.find((s) => (!s.method || s.method === method) && s.match(url))
    if (!stub) {
      // Loud by design: an unplanned call is a gap in the test, not something
      // to pass through to a network.
      return route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({ code: 501, status: 'Not stubbed', message: `No E2E stub for ${method} ${url.pathname}` }),
      })
    }
    await stub.handler(route, url)
  })
}

/** Seed a staff session in localStorage before the app boots. */
export async function signInAsStaff(page: Page): Promise<void> {
  await page.addInitScript((token: string) => {
    localStorage.setItem('mot_access_token', token)
    localStorage.setItem('mot_refresh_token', token)
  }, jwt())
}

/** Seed a customer-portal session before the app boots. */
export async function signInAsCustomer(page: Page): Promise<void> {
  await page.addInitScript((token: string) => {
    localStorage.setItem('mot_customer_access_token', token)
    localStorage.setItem('mot_customer_refresh_token', token)
  }, jwt('c1'))
}
