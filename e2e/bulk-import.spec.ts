import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { respond, signInAsStaff, stubApi } from './fixtures/api'

/**
 * Importing an existing diary: paste the AI's JSON → preview → import.
 *
 * The API is stubbed, so this protects the journey and the contract the UI
 * sends (dry run first, then a commit of the same payload with the
 * acknowledgement), not the import rules - those are the server's and are
 * tested there (MOT-backend tests/api/test_bulk_import.py).
 */

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

const FORMATS = {
  services: { example: { services: [] }, json_schema: {}, ai_prompt_template: '{{service_names}}' },
  appointments: {
    example: { appointments: [{ service: 'MOT test', start: '2026-03-10T09:30' }] },
    json_schema: {},
    ai_prompt_template: 'Services: {{service_names}}. Times in {{timezone}}.',
  },
  defaults: { timezone: 'Europe/London', statuses: ['BOOKED'] },
  limits: { max_body_bytes: 1048576, max_services: 500, max_appointments: 1000 },
}

const PAYLOAD = {
  appointments: [
    {
      service: 'MOT test',
      start: '2026-03-10T09:30',
      customer: { first_name: 'Sam', last_name: 'Lee', phone: '07123 456789' },
    },
    {
      service: 'MOT test',
      start: '2026-03-10T10:00',
      customer: { first_name: 'Alex', last_name: 'Kim' },
    },
  ],
}

function item(index: number, start: string, end: string, name: [string, string], extra = {}) {
  return {
    index,
    status: 'NEW',
    normalised: {
      service: 'MOT test',
      start,
      end,
      status: 'BOOKED',
      employee: { email: OWNER.email, name: 'Greg Mason' },
      customer: { first_name: name[0], last_name: name[1], phone: null, email: null, match: 'new' },
      notes: null,
      flags: [],
    },
    errors: [],
    warnings: [],
    ...extra,
  }
}

function result(dryRun: boolean) {
  return {
    kind: 'appointments',
    ok: true,
    dry_run: dryRun,
    committed: !dryRun,
    counts: { new: 2, exists: 0, error: 0, warning: 1 },
    items: [
      item(0, '2026-03-10T09:30:00+00:00', '2026-03-10T10:30:00+00:00', ['Sam', 'Lee']),
      item(1, '2026-03-10T10:00:00+00:00', '2026-03-10T11:00:00+00:00', ['Alex', 'Kim'], {
        normalised: {
          ...item(1, '2026-03-10T10:00:00+00:00', '2026-03-10T11:00:00+00:00', ['Alex', 'Kim']).normalised,
          flags: ['clash'],
        },
        warnings: [{ path: 'appointments[1].start', message: 'Greg Mason already has an appointment during this time.' }],
      }),
    ],
    warnings: [],
    context: { timezone: 'Europe/London' },
  }
}

test.describe('import appointments from pasted JSON', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page)
  })

  test('paste → preview → acknowledge the clash → import', async ({ page }) => {
    const posted: { dry_run: boolean; acknowledge_warnings: boolean; payload: unknown }[] = []
    await stubApi(page, [
      { path: '/api/employees/', handler: (route) => respond.json(route, [OWNER]) },
      { path: '/api/bulk-import/formats', handler: (route) => respond.json(route, FORMATS) },
      {
        method: 'POST',
        path: '/api/appointments/bulk',
        handler: (route) => {
          const body = route.request().postDataJSON()
          posted.push(body)
          return respond.json(route, result(body.dry_run))
        },
      },
    ])

    await page.goto('/g1/appointments?view=week&date=2026-03-11')
    await page.getByRole('button', { name: 'Import appointments' }).click()
    const dialog = page.getByRole('dialog', { name: 'Import appointments' })

    // AIs often wrap their answer in a code fence; that still counts as JSON.
    await dialog.getByLabel('Paste JSON').fill('```json\n' + JSON.stringify(PAYLOAD, null, 2) + '\n```')
    await expect(dialog.getByText('Valid JSON.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Preview' }).click()

    await expect(dialog.getByRole('list', { name: 'Preview summary' })).toContainText('New2')
    await expect(dialog.getByText('Double-booked')).toBeVisible()

    await dialog.getByRole('tab', { name: 'Calendar' }).click()
    await expect(dialog.getByRole('button', { name: /Warning: 10:00 Alex Kim/ })).toBeVisible()

    const importButton = dialog.getByRole('button', { name: 'Import 2 appointments' })
    await expect(importButton).toBeDisabled()
    await dialog.getByRole('checkbox', { name: /import anyway/i }).check()
    await importButton.click()

    await expect(page.getByText('Imported 2 appointments.')).toBeVisible()
    await expect(dialog).toBeHidden()
    expect(posted.map((p) => [p.dry_run, p.acknowledge_warnings])).toEqual([
      [true, false],
      [false, true],
    ])
    expect(posted[1].payload).toEqual(PAYLOAD)
  })

  test('the import dialog has no detectable accessibility violations', async ({ page }) => {
    await stubApi(page, [
      { path: '/api/employees/', handler: (route) => respond.json(route, [OWNER]) },
      { path: '/api/bulk-import/formats', handler: (route) => respond.json(route, FORMATS) },
      {
        method: 'POST',
        path: '/api/appointments/bulk',
        handler: (route) => respond.json(route, result(true)),
      },
    ])
    await page.goto('/g1/appointments')
    await page.getByRole('button', { name: 'Import appointments' }).click()
    const dialog = page.getByRole('dialog', { name: 'Import appointments' })
    await dialog.getByLabel('Paste JSON').fill(JSON.stringify(PAYLOAD))
    await dialog.getByRole('button', { name: 'Preview' }).click()
    await expect(dialog.getByText('Double-booked')).toBeVisible()

    const scan = () =>
      new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze()
    expect((await scan()).violations.map((v) => v.id)).toEqual([])
    await dialog.getByRole('tab', { name: 'Calendar' }).click()
    expect((await scan()).violations.map((v) => v.id)).toEqual([])
  })

  test('on a phone the dialog never scrolls the page sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await stubApi(page, [
      { path: '/api/employees/', handler: (route) => respond.json(route, [OWNER]) },
      { path: '/api/bulk-import/formats', handler: (route) => respond.json(route, FORMATS) },
      {
        method: 'POST',
        path: '/api/appointments/bulk',
        handler: (route) => respond.json(route, result(true)),
      },
    ])
    await page.goto('/g1/appointments')
    await page.getByRole('button', { name: 'Import appointments' }).click()
    const dialog = page.getByRole('dialog', { name: 'Import appointments' })
    await dialog.getByLabel('Paste JSON').fill(JSON.stringify(PAYLOAD))
    await dialog.getByRole('button', { name: 'Preview' }).click()
    await dialog.getByRole('tab', { name: 'Calendar' }).click()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
