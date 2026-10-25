import type { Page, Route } from '@playwright/test'
import {
  APPOINTMENT_TYPES,
  APPOINTMENT_TYPE_GROUPS,
  AVAILABILITY,
  BOOKING_FLOW,
  CAPACITY,
  CUSTOMERS,
  DAY_AVAILABILITY,
  FLOW_PRESETS,
  FLOW_SECTIONS,
  GARAGE,
  PUBLIC_GARAGE,
  QUEUE_DASHBOARD,
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

/** Fixture businesses that picked their own booking-page colours - one dark
 * page with light text, one light page with dark text - plus `none`, the same
 * business on the default look, to compare against. */
export const THEMED_GARAGES = {
  none: PUBLIC_GARAGE,
  dark: { ...PUBLIC_GARAGE, booking_background_color: '#0b1f3a', booking_text_color: '#f5f7fa' },
  light: { ...PUBLIC_GARAGE, booking_background_color: '#fefce8', booking_text_color: '#1e3a8a' },
} as const

/** What the walk-in queue join page needs for an open queue. */
export const OPEN_PUBLIC_QUEUE = {
  garage_name: 'Bennett Motors',
  is_open: true,
  accepting_joins: true,
  refusal_reason: null,
  refusal_message: null,
  waiting_count: 1,
  estimated_start_at: '2099-09-14T10:30:00Z',
  estimated_wait_minutes: 30,
  opens_at: '2099-09-14T08:00:00Z',
  closes_at: '2099-09-14T16:00:00Z',
  join_fields: {
    name: { enabled: true, required: true },
    phone: { enabled: true, required: true },
    email: { enabled: false, required: false },
    vehicle_registration: { enabled: false, required: false },
  },
}

/** Serve one of {@link THEMED_GARAGES} (and an open queue) for the public pages. */
export function themedGarage(theme: keyof typeof THEMED_GARAGES): Override[] {
  return [
    { path: /^\/api\/public\/garages\/[^/]+$/, handler: (r) => json(r, THEMED_GARAGES[theme]) },
    { path: '/api/public/bennett-motors/queue', handler: (r) => json(r, OPEN_PUBLIC_QUEUE) },
  ]
}

function defaults(): Stub[] {
  return [
    // auth
    { method: 'POST', match: (u) => u.pathname === '/api/auth/login', handler: (r) => json(r, { access_token: jwt(), refresh_token: jwt() }) },
    { method: 'POST', match: (u) => u.pathname === '/api/auth/register', handler: (r) => json(r, { access_token: jwt(), refresh_token: jwt() }) },
    { method: 'POST', match: (u) => u.pathname === '/api/auth/refresh', handler: (r) => json(r, { access_token: jwt() }) },
    { method: 'POST', match: (u) => u.pathname === '/api/customer/auth/login/reference', handler: (r) => json(r, { access_token: jwt('c1'), refresh_token: jwt('c1') }) },
    { method: 'POST', match: (u) => u.pathname === '/api/customer/auth/login/password', handler: (r) => json(r, { access_token: jwt('c1'), refresh_token: jwt('c1') }) },
    { method: 'POST', match: (u) => u.pathname === '/api/customer/auth/set-password', handler: (r) => r.fulfill({ status: 204 }) },

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
    { match: (u) => u.pathname === '/api/appointment-type-groups/', handler: (r) => json(r, APPOINTMENT_TYPE_GROUPS) },
    { match: (u) => u.pathname === '/api/booking-flow/sections', handler: (r) => json(r, FLOW_SECTIONS) },
    { match: (u) => u.pathname === '/api/booking-flow/presets', handler: (r) => json(r, FLOW_PRESETS) },
    { match: (u) => u.pathname === '/api/appointments/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/employees/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/roles/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/calendar-export/feeds', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/booking-requests/', handler: (r) => json(r, []) },
    { match: (u) => u.pathname === '/api/communications/unread-count', handler: (r) => json(r, { whatsapp_unread: 0 }) },
    { match: (u) => u.pathname === '/api/queue', handler: (r) => json(r, QUEUE_DASHBOARD) },
    {
      match: (u) => u.pathname === '/api/loyalty/settings',
      handler: (r) =>
        json(r, { enabled: false, visits_required: 5, discount_type: 'PERCENTAGE', discount_value: '10.00', expiry_days: 90, enabled_at: null }),
    },
    { match: (u) => u.pathname === '/api/loyalty/codes', handler: (r) => json(r, { items: [], total: 0 }) },
    {
      match: (u) => /^\/api\/loyalty\/customers\/[^/]+$/.test(u.pathname),
      handler: (r) =>
        json(r, { enabled: false, visits_required: null, completed_visits: 0, visits_to_next_reward: null, marketing_email_opt_out: false, codes: [] }),
    },

    // public booking
    { match: (u) => /^\/api\/public\/garages\/[^/]+$/.test(u.pathname), handler: (r) => json(r, PUBLIC_GARAGE) },
    { match: (u) => u.pathname.endsWith('/booking-flow'), handler: (r) => json(r, BOOKING_FLOW) },
    { match: (u) => u.pathname.endsWith('/availability'), handler: (r) => json(r, AVAILABILITY) },
    { match: (u) => /\/availability\/\d{4}-\d{2}-\d{2}$/.test(u.pathname), handler: (r) => json(r, DAY_AVAILABILITY) },
    { method: 'POST', match: (u) => u.pathname.endsWith('/booking-requests'), handler: (r) => json(r, { id: 'br1', status: 'PENDING', booking_reference: 'BK7F3K9Q2' }, 201) },
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

/**
 * Stand-in for Square's Web Payments SDK. Square only ships it as a hosted
 * script, so the CDN is routed to this stub (never the real network): a card
 * "field" that is just an input, and tokenize() that returns a fixed
 * single-use token. Records every load so a test can assert the script was
 * only fetched once a Square deposit was actually due.
 */
export async function stubSquareSdk(page: Page): Promise<{ loads: string[] }> {
  const loads: string[] = []
  const sdk = `
    window.Square = {
      payments: function (applicationId, locationId) {
        window.__squarePayments = { applicationId: applicationId, locationId: locationId }
        return {
          card: async function () {
            return {
              attach: async function (el) {
                var input = document.createElement('input')
                input.setAttribute('aria-label', 'Card number')
                el.appendChild(input)
              },
              tokenize: async function (details) {
                window.__squareVerification = details
                return { status: 'OK', token: 'cnon:e2e-card' }
              },
              destroy: async function () { return true },
            }
          },
        }
      },
    }
  `
  await page.route(/https:\/\/(sandbox\.)?web\.squarecdn\.com\/.*/, (route) => {
    loads.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: sdk })
  })
  return { loads }
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
