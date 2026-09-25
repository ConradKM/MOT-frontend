import { expect, test } from '@playwright/test'
import { respond, signInAsStaff, stubApi } from './fixtures/api'

/**
 * The walk-in queue golden path, both sides of the counter: a customer scans
 * the queue QR code, joins, watches their place, and is told it's their turn
 * the moment staff call them - with no refresh, just the page's own polling.
 *
 * Both pages share one in-memory "server" below, so the staff click really is
 * what changes what the customer sees.
 */

const TOKEN = 'tok_0123456789abcdefghij'
const NOW = '2099-09-14T10:00:00Z'

type Status = 'WAITING' | 'CALLED'

function statusBody(status: Status) {
  return {
    garage_name: 'Bennett Motors',
    queue_is_open: true,
    ticket_number: 7,
    status,
    end_reason: null,
    customer_first_name: 'Oliver',
    position: status === 'WAITING' ? 2 : null,
    people_ahead: status === 'WAITING' ? 1 : null,
    estimated_start_at: status === 'WAITING' ? '2099-09-14T10:30:00Z' : null,
    estimated_wait_minutes: status === 'WAITING' ? 30 : null,
    fits_today: status === 'WAITING' ? true : null,
    called_at: status === 'CALLED' ? NOW : null,
    call_expires_at: status === 'CALLED' ? '2099-09-14T10:10:00Z' : null,
  }
}

function entryBody(status: Status) {
  return {
    id: 'q7',
    status,
    end_reason: null,
    ticket_number: 7,
    customer_first_name: 'Oliver',
    customer_last_name: null,
    customer_phone: '+447123456789',
    sms_opt_in: true,
    vehicle_registration: null,
    notes: null,
    appointment_type_id: null,
    appointment_type_name: null,
    service_minutes: 30,
    joined_at: NOW,
    called_at: status === 'CALLED' ? NOW : null,
    started_at: null,
    ended_at: null,
    appointment_id: null,
    position: status === 'WAITING' ? 1 : null,
    estimated_start_at: status === 'WAITING' ? NOW : null,
    estimated_wait_minutes: status === 'WAITING' ? 0 : null,
    fits_today: status === 'WAITING' ? true : null,
    call_expires_at: status === 'CALLED' ? '2099-09-14T10:10:00Z' : null,
  }
}

test('a walk-in joins, sees their place, and is told when they are called', async ({ browser }) => {
  let status: Status = 'WAITING'
  let joinBody: Record<string, unknown> = {}

  const customerContext = await browser.newContext()
  const customer = await customerContext.newPage()
  await customer.clock.install({ time: new Date(NOW) })
  await stubApi(customer, [
    {
      path: '/api/public/bennett-motors/queue',
      handler: (r) =>
        respond.json(r, {
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
        }),
    },
    {
      method: 'POST',
      path: '/api/public/bennett-motors/queue/join',
      handler: (r) => {
        joinBody = JSON.parse(r.request().postData() ?? '{}')
        return respond.json(r, { ...statusBody('WAITING'), token: TOKEN }, 201)
      },
    },
    {
      method: 'POST',
      path: '/api/public/bennett-motors/queue/status',
      handler: (r) => {
        // The token is only ever in the body - never the URL.
        expect(new URL(r.request().url()).search).toBe('')
        expect(JSON.parse(r.request().postData() ?? '{}')).toEqual({ token: TOKEN })
        return respond.json(r, statusBody(status))
      },
    },
  ])

  // --- The customer scans the QR code and joins ------------------------------
  await customer.goto('/queue/g1')
  await expect(customer.getByRole('heading', { name: 'Bennett Motors' })).toBeVisible()
  await expect(customer.getByText('about 30 min')).toBeVisible()
  await customer.getByLabel('First name').fill('Oliver')
  await customer.getByLabel('Mobile number').fill('07123 456789')
  await customer.getByLabel(/Text me when it's my turn/).check()
  await customer.getByRole('button', { name: 'Join the queue' }).click()

  await expect(customer).toHaveURL(new RegExp(`/queue/g1/status#${TOKEN}$`))
  expect(joinBody).toMatchObject({ customer_first_name: 'Oliver', sms_opt_in: true })
  await expect(customer.getByText('Your position')).toBeVisible()
  await expect(customer.getByText('1 person ahead')).toBeVisible()

  // --- Staff call them from the live queue --------------------------------------
  const staffContext = await browser.newContext()
  const staff = await staffContext.newPage()
  await signInAsStaff(staff)
  await stubApi(staff, [
    {
      path: '/api/queue',
      handler: (r) =>
        respond.json(r, {
          now: NOW,
          service_date: '2099-09-14',
          is_open: true,
          accepting_joins: true,
          refusal_reason: null,
          refusal_message: null,
          capacity: 1,
          opens_at: '2099-09-14T08:00:00Z',
          closes_at: '2099-09-14T16:00:00Z',
          no_show_timeout_minutes: 10,
          average: { effective_minutes: 30, source: 'AUTO', auto_minutes: 30, auto_sample_size: 8 },
          new_joiner_estimated_start_at: '2099-09-14T10:30:00Z',
          new_joiner_fits_today: true,
          entries: [entryBody(status)],
          appointments: [],
        }),
    },
    {
      method: 'POST',
      path: '/api/queue/call-next',
      handler: (r) => {
        status = 'CALLED'
        return respond.json(r, entryBody('CALLED'))
      },
    },
  ])
  await staff.goto('/g1/queue')
  const waiting = staff.getByRole('region', { name: 'Waiting' })
  await expect(waiting.getByLabel('Ticket 7, Oliver')).toBeVisible()
  await staff.getByRole('button', { name: 'Call next' }).click()
  await expect(
    staff.getByRole('region', { name: 'Called forward' }).getByLabel('Ticket 7, Oliver'),
  ).toBeVisible()

  // --- The customer's page picks it up on its next poll -------------------------
  await customer.clock.fastForward('00:21')
  await expect(customer.getByText("It's your turn!")).toBeVisible()
  await expect(customer.getByRole('button', { name: 'Leave the queue' })).toBeVisible()

  await customerContext.close()
  await staffContext.close()
})

test('the queue page says so when walk-ins are not being taken', async ({ page }) => {
  await stubApi(page, [
    {
      path: '/api/public/bennett-motors/queue',
      handler: (r) =>
        respond.json(r, {
          garage_name: 'Bennett Motors',
          is_open: false,
          accepting_joins: false,
          refusal_reason: 'queue_closed',
          refusal_message: "The walk-in queue isn't open right now.",
          waiting_count: 0,
          estimated_start_at: null,
          estimated_wait_minutes: null,
          opens_at: null,
          closes_at: null,
        }),
    },
  ])
  await page.goto('/queue/g1')
  await expect(page.getByText("The walk-in queue isn't open right now.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join the queue' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Book an appointment instead' }).click()
  await expect(page).toHaveURL(/\/book\/g1$/)
})
