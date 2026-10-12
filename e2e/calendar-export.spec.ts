import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { respond, signInAsStaff, stubApi } from './fixtures/api'

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

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//CoMaz OS//Appointments//EN',
  'BEGIN:VEVENT',
  'UID:a1@comaz.co.uk',
  'SUMMARY:MOT - AB12CDE',
  'DTSTART:20260310T090000Z',
  'DTEND:20260310T100000Z',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

test.describe('add appointments to a calendar', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page)
  })

  test('open calendar → Add to calendar → download an .ics for the visible week', async ({ page }) => {
    const requested: URLSearchParams[] = []
    await stubApi(page, [
      { path: '/api/employees/', handler: (route) => respond.json(route, [OWNER]) },
      {
        path: '/api/calendar-export/appointments.ics',
        handler: (route, url) => {
          requested.push(url.searchParams)
          return route.fulfill({
            status: 200,
            contentType: 'text/calendar; charset=utf-8',
            headers: { 'Content-Disposition': 'attachment; filename="appointments.ics"' },
            body: ICS,
          })
        },
      },
    ])

    await page.goto('/g1/appointments?view=week&date=2026-03-11')
    await page.getByRole('button', { name: 'Add to calendar' }).click()

    const dialog = page.getByRole('dialog', { name: 'Add to calendar' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/never customer details/)).toBeVisible()
    await expect(dialog.getByRole('radio', { name: 'All workers' })).toBeChecked()
    await expect(dialog.getByLabel('From')).toHaveValue('2026-03-09')
    await expect(dialog.getByLabel('to', { exact: true })).toHaveValue('2026-03-15')

    const downloadPromise = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Download .ics file' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('appointments.ics')
    expect(await readFile((await download.path()) as string, 'utf8')).toBe(ICS)
    expect(requested[0].toString()).toBe('scope=ALL&start_date=2026-03-09&end_date=2026-03-15')
    await expect(page.getByText(/Calendar file downloaded/)).toBeVisible()
  })

  test('a range the server refuses shows how to narrow it', async ({ page }) => {
    await stubApi(page, [
      { path: '/api/employees/', handler: (route) => respond.json(route, [OWNER]) },
      {
        path: '/api/calendar-export/appointments.ics',
        handler: (route) =>
          respond.apiError(route, 422, 'This would export 6000 appointments; the limit is 5000. Narrow the date range, workers or appointment types.'),
      },
    ])
    await page.goto('/g1/appointments?view=week&date=2026-03-11')
    await page.getByRole('button', { name: 'Add to calendar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add to calendar' })
    await dialog.getByRole('button', { name: 'Download .ics file' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Narrow the date range')
  })

  test('the dialog has no detectable accessibility violations on either tab', async ({ page }) => {
    await stubApi(page, [{ path: '/api/employees/', handler: (route) => respond.json(route, [OWNER]) }])
    await page.goto('/g1/appointments')
    await page.getByRole('button', { name: 'Add to calendar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add to calendar' })
    await expect(dialog.getByText('MOT test').first()).toBeVisible()

    // Same ruleset as e2e/a11y.spec.ts (colour contrast is pinned there).
    const scan = () =>
      new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze()
    expect((await scan()).violations.map((v) => v.id)).toEqual([])

    await dialog.getByRole('tab', { name: 'Subscribe (stays updated)' }).click()
    await expect(dialog.getByText('You haven’t created any links yet.')).toBeVisible()
    expect((await scan()).violations.map((v) => v.id)).toEqual([])
  })
})
