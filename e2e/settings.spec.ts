import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { respond, signInAsStaff, stubApi, type Override } from './fixtures/api'

/**
 * The Settings area in a real browser: things jsdom can't judge.
 *
 * - Colour contrast. Every settings page is swept with axe *including*
 *   `color-contrast`, scoped to the settings area (`.settings-scope`) - the
 *   staff chrome around it is covered by a11y.spec.ts. The booking-page
 *   preview on Booking Page Appearance is excluded on purpose: it reproduces
 *   the customer's page exactly, and the customer pages have their own
 *   themed contrast checks.
 * - Layout. Opening a row's editor must not move the table header - the
 *   point of the fixed-layout, expand-beneath-the-row tables.
 */

const RULESET = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const OWNER = {
  id: 'e1',
  garage_id: 'g1',
  email: 'greg@bennett.example',
  first_name: 'Greg',
  last_name: 'Mason',
  is_active: true,
  roles: [{ id: 'r1', garage_id: 'g1', name: 'OWNER', created_at: '', updated_at: '' }],
  created_at: '',
  updated_at: '',
}

const STATUSES = [
  { id: 's1', garage_id: 'g1', key: 'BOOKED', label: 'Booked in', color: 'blue', sort_order: 1, is_terminal: false, is_system: true, created_at: '', updated_at: '' },
  { id: 's2', garage_id: 'g1', key: 'WAITING_FOR_PARTS', label: 'Waiting for parts', color: 'amber', sort_order: 2, is_terminal: false, is_system: false, created_at: '', updated_at: '' },
]

const VOICE_ACTIONS = [
  { key: 'AI_BOOKING', label: 'AI booking assistant', accepts_target: false, can_be_fallback: true, available: true },
  { key: 'HUMAN_TRANSFER', label: 'Transfer to a person', accepts_target: true, can_be_fallback: true, available: true },
]

/** What the settings pages read that the shared defaults don't serve. */
const SETTINGS_STUBS: Override[] = [
  { path: '/api/employees/', handler: (r) => respond.json(r, [OWNER]) },
  { path: '/api/roles/', handler: (r) => respond.json(r, OWNER.roles) },
  { path: '/api/appointment-statuses/', handler: (r) => respond.json(r, STATUSES) },
  {
    path: /^\/api\/appointment-types\/[^/]+\/checklist-template$/,
    handler: (r) => respond.json(r, { id: 'ct1', appointment_type_id: 'at1', items: [] }),
  },
  {
    path: '/api/garage/schedule',
    handler: (r) =>
      respond.json(r, {
        settings: {
          id: 'sch1',
          slot_interval_minutes: 30,
          default_appointment_minutes: 60,
          min_lead_time_hours: 2,
          max_advance_days: 60,
          capacity_per_slot: null,
          limited_threshold_ratio: 0.5,
        },
        opening_hours: [],
        exceptions: [{ id: 'x1', date: '2099-12-25', is_closed: true, opens_at: null, closes_at: null, note: 'Christmas' }],
      }),
  },
  {
    path: '/api/garage/terms',
    handler: (r) =>
      respond.json(r, {
        terms_and_conditions: 'Deposits are non-refundable.',
        terms_version: 2,
        terms_updated_at: '2099-01-01T09:00:00Z',
      }),
  },
  {
    path: '/api/booking-flow/vehicle-details',
    handler: (r) =>
      respond.json(r, {
        fields: {
          registration: { enabled: true, required: true },
          make: { enabled: true, required: false },
          model: { enabled: false, required: false },
        },
        services_with_own_workflow: 0,
      }),
  },
  {
    path: '/api/reminders/appointment-settings',
    handler: (r) =>
      respond.json(r, {
        id: 'rs1',
        enabled: true,
        channels: ['email'],
        available_channels: ['email'],
        timings: [{ id: 't1', hours_before: 24, enabled: true }],
      }),
  },
  {
    path: '/api/communications/automation-settings',
    handler: (r) =>
      respond.json(r, {
        booking_ack_enabled: true,
        booking_confirmation_enabled: true,
        reminder_enabled: true,
        reminder_hours_before: 24,
        missed_call_ack_enabled: false,
        conversation_automation_enabled: false,
      }),
  },
  {
    path: '/api/communications/templates',
    handler: (r) =>
      respond.json(r, {
        items: [
          {
            key: 'booking_acknowledgement',
            body: 'Thanks for your booking request with {{business_name}}.',
            default_body: 'Thanks for your booking request with {{business_name}}.',
            is_custom: true,
          },
        ],
      }),
  },
  {
    path: '/api/communications/voice-menu',
    handler: (r) =>
      respond.json(r, {
        enabled: true,
        greeting: null,
        options: [{ digit: '1', label: 'bookings', prompt: null, action: 'AI_BOOKING', target: null }],
        fallback_action: 'HUMAN_TRANSFER',
        fallback_target: null,
        max_attempts: 2,
        ai_available: true,
        platform_transfer_configured: true,
        supported_actions: VOICE_ACTIONS,
      }),
  },
  {
    path: '/api/payments/provider',
    handler: (r) =>
      respond.json(r, {
        provider: 'square',
        options: [
          { name: 'stripe', ready: false },
          { name: 'square', ready: true },
        ],
      }),
  },
  {
    path: '/api/payments/stripe/status',
    handler: (r) =>
      respond.json(r, {
        provider: null,
        stripe_account_id: 'acct_1',
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        apple_pay_status: null,
        apple_pay_status_details: null,
      }),
  },
  {
    path: '/api/payments/square/status',
    handler: (r) =>
      respond.json(r, {
        status: 'CONNECTED',
        merchant_id: 'MLMERCHANT1',
        merchant_name: 'Bennett Motors Ltd',
        location_id: 'LOC_1',
        location_name: 'Main garage',
        locations: [{ id: 'LOC_1', name: 'Main garage', currency: 'GBP', can_take_card_payments: true, eligible: true }],
        can_take_card_payments: true,
        currency: 'GBP',
        charges_in_currency: true,
        ready: true,
        environment: 'sandbox',
        deployment_configured: true,
      }),
  },
  {
    path: '/api/queue/settings',
    handler: (r) =>
      respond.json(r, {
        is_open: true,
        average_mode: 'AUTO',
        manual_average_minutes: null,
        no_show_timeout_minutes: 10,
        default_appointment_type_id: null,
        average: { effective_minutes: 35, source: 'AUTO', auto_minutes: 35, auto_sample_size: 9 },
        capacity: 2,
        capacity_per_slot: 2,
        collect_name: true,
        name_required: true,
        collect_phone: true,
        phone_required: false,
        collect_email: false,
        email_required: false,
        collect_vehicle_registration: false,
        vehicle_registration_required: false,
      }),
  },
  { path: '/api/queue/reserved-windows', handler: (r) => respond.json(r, []) },
]

async function openSettings(page: Page, path: string) {
  // No transitions mid-scan, and the expand animation finishes instantly.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signInAsStaff(page)
  await stubApi(page, SETTINGS_STUBS)
  await page.goto(path)
  await expect(page.locator('.settings-scope h1')).toBeVisible()
}

async function contrastAndA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(RULESET)
    .include('.settings-scope')
    .exclude('[data-testid="booking-preview"]')
    .analyze()
  return results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`,
  )
}

test.describe('every settings page is readable and accessible', () => {
  for (const [name, path] of [
    ['Business Details', '/g1/settings/garage-details'],
    ['Share your business', '/g1/settings/share'],
    ['Availability', '/g1/settings/availability'],
    ['Appointment Types', '/g1/settings/appointment-types'],
    ['Appointment Statuses', '/g1/settings/appointment-statuses'],
    ['Booking Workflow: services & groups', '/g1/settings/booking-workflow'],
    ['Booking Workflow: what you ask', '/g1/settings/booking-workflow?tab=workflow'],
    ['Terms & Conditions', '/g1/settings/terms'],
    ['Booking Page Appearance', '/g1/settings/booking-appearance'],
    ['Appointment Reminders', '/g1/settings/reminders'],
    ['Customer & sale reminders', '/g1/settings/reminders/customer'],
    ['Employees', '/g1/settings/employees'],
    ['Roles', '/g1/settings/roles'],
    ['Communications: automated messages', '/g1/settings/communications-automation'],
    ['Communications: phone menu', '/g1/settings/communications-automation?tab=phone-menu'],
    ['Communications: templates', '/g1/settings/communications-automation?tab=templates'],
    ['Payments', '/g1/settings/payments'],
    ['Walk-in Queue', '/g1/settings/walk-in-queue'],
  ] as const) {
    test(`${name} has no violations, colour contrast included`, async ({ page }) => {
      await openSettings(page, path)
      // Let queries settle so the scan sees the loaded page, not "Loading…".
      await expect(page.getByText('Loading…')).toHaveCount(0)
      expect((await contrastAndA11y(page)).join('\n\n')).toBe('')
    })
  }

  test('an open row editor and an open tip are clean too', async ({ page }) => {
    await openSettings(page, '/g1/settings/appointment-types')
    const row = page.getByRole('row', { name: /MOT test/ })
    await row.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('region', { name: 'Edit MOT test' })).toBeVisible()
    await page.getByRole('button', { name: 'About Appointment Types' }).hover()
    await expect(page.getByRole('tooltip')).toBeVisible()
    expect((await contrastAndA11y(page)).join('\n\n')).toBe('')
  })
})

type Box = { x: number; width: number }

async function headerBoxes(page: Page, table: string): Promise<Box[]> {
  return page
    .getByRole('table', { name: table })
    .locator('thead th')
    .evaluateAll((cells) =>
      cells.map((c) => {
        const r = c.getBoundingClientRect()
        return { x: Math.round(r.x * 10) / 10, width: Math.round(r.width * 10) / 10 }
      }),
    )
}

test.describe('opening an editor never moves the table header', () => {
  for (const [label, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['phone', { width: 375, height: 812 }],
  ] as const) {
    for (const [page_, path, table, rowName] of [
      ['Appointment Types', '/g1/settings/appointment-types', 'Appointment types', /MOT test/],
      ['Appointment Statuses', '/g1/settings/appointment-statuses', 'Appointment statuses', /Booked in/],
      ['Employees', '/g1/settings/employees', 'Employees', /Greg Mason/],
    ] as const) {
      test(`${page_} on ${label}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await openSettings(page, path)
        const before = await headerBoxes(page, table)
        expect(before.length).toBeGreaterThan(0)

        const row = page.getByRole('row', { name: rowName })
        await row.getByRole('button', { name: 'Edit' }).click()
        await expect(row.getByRole('button', { name: 'Close' })).toBeVisible()
        await expect(page.getByRole('region', { name: /^Edit / })).toBeVisible()

        expect(await headerBoxes(page, table)).toEqual(before)

        // On a phone the table scrolls inside its own wrapper, never the page.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(0)
      })
    }
  }
})
