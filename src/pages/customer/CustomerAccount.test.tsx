import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { renderWithAppProviders, signInAsCustomer } from '../../test/utils'
import { CustomerAccount } from './CustomerAccount'
import { getCustomerAccessToken } from '../../api/customerTokens'
import { expectNoA11yViolations } from '../../test/a11y'

const NOW = new Date('2026-06-15T12:00:00Z')

const vehicle = (patch = {}) => ({
  id: 'v1',
  registration_number: 'OB08AUD',
  make: 'Audi',
  model: 'A4',
  year: 2018,
  current_mileage: 40000,
  mot_expiry_date: '2026-08-12',
  mot_records: [{ id: 'm1', mot_date: '2025-08-12', result: 'PASS' }],
  ...patch,
})

const appointment = (patch = {}) => ({
  id: 'a1',
  appointment_type_name: 'MOT test',
  start_time: '2026-07-01T09:00:00+01:00',
  end_time: '2026-07-01T09:45:00+01:00',
  status: 'BOOKED',
  vehicle_registration: 'OB08AUD',
  ...patch,
})

const appointmentDetail = (patch = {}) => ({
  id: 'a1',
  start_time: '2026-07-01T09:00:00+01:00',
  end_time: '2026-07-01T09:45:00+01:00',
  status: 'BOOKED',
  notes: null,
  appointment_type_name: 'MOT test',
  appointment_type_description: 'Annual statutory test.',
  vehicle: { registration_number: 'OB08AUD', make: 'Audi', model: 'A4', year: 2018 },
  garage_name: 'Bennett Motors',
  ...patch,
})

function serveAccount(body: unknown) {
  server.use(http.get('*/api/customer/account', () => HttpResponse.json(body)))
}

function serveAppointmentDetail(id: string, body: unknown) {
  server.use(http.get(`*/api/customer/appointments/${id}`, () => HttpResponse.json(body)))
}

const ACCOUNT = {
  customer: {
    first_name: 'Oliver',
    last_name: 'Bennett',
    email: 'oliver@example.com',
    phone: '+447700900001',
    garage_name: 'Bennett Motors',
    has_password: false,
  },
  vehicles: [vehicle()],
  appointments: [appointment()],
}

function renderAccount() {
  signInAsCustomer()
  return renderWithAppProviders(
    <Routes>
      <Route path="/customer/account" element={<CustomerAccount />} />
      <Route path="/customer/login" element={<h1>Customer sign in</h1>} />
    </Routes>,
    { route: '/customer/account' },
  )
}

async function expandVehicle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText('OB08AUD'))
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('CustomerAccount — loading and failure', () => {
  it('says it is loading before the account arrives', async () => {
    server.use(
      http.get('*/api/customer/account', async () => {
        await delay(50)
        return HttpResponse.json(ACCOUNT)
      }),
    )
    renderAccount()
    expect(screen.getByText(/loading your account/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Hi Oliver' })).toBeInTheDocument()
  })

  it('offers a way to sign in again when the session is no longer valid', async () => {
    server.use(
      http.get('*/api/customer/account', () =>
        HttpResponse.json({ code: 401, status: 'x', message: 'Session expired.' }, { status: 401 }),
      ),
      http.post('*/api/customer/auth/refresh', () =>
        HttpResponse.json({ code: 401, status: 'x' }, { status: 401 }),
      ),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAccount()

    expect(await screen.findByText('Session expired.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /sign in again/i }))
    expect(await screen.findByRole('heading', { name: 'Customer sign in' })).toBeInTheDocument()
    expect(getCustomerAccessToken()).toBeNull()
  })

  it('shows an error rather than a blank page when the server fails', async () => {
    server.use(
      http.get('*/api/customer/account', () =>
        HttpResponse.json({ code: 500, status: 'x', message: 'Something broke.' }, { status: 500 }),
      ),
    )
    renderAccount()
    expect(await screen.findByText('Something broke.')).toBeInTheDocument()
  })
})

describe('CustomerAccount — content', () => {
  it('greets the customer and names their garage', async () => {
    serveAccount(ACCOUNT)
    renderAccount()
    expect(await screen.findByRole('heading', { name: 'Hi Oliver' })).toBeInTheDocument()
    expect(screen.getByText('Bennett Motors')).toBeInTheDocument()
  })

  it('shows the account details: name, email, phone', async () => {
    serveAccount(ACCOUNT)
    renderAccount()
    await screen.findByRole('heading', { name: 'Hi Oliver' })

    const details = screen.getByRole('heading', { name: 'Your details' }).parentElement!
    expect(within(details).getByText('Oliver Bennett')).toBeInTheDocument()
    expect(within(details).getByText('oliver@example.com')).toBeInTheDocument()
    expect(within(details).getByText('+447700900001')).toBeInTheDocument()
  })

  it('shows each vehicle collapsed, with its registration and MOT status visible up front', async () => {
    serveAccount(ACCOUNT)
    renderAccount()
    const summary = (await screen.findByText('OB08AUD')).closest('summary') as HTMLElement
    expect(within(summary).getByText('Audi A4 2018')).toBeInTheDocument()
    // Expires 2026-08-12, ~58 days after the pinned "now".
    expect(within(summary).getByText('Valid')).toBeInTheDocument()
    // The full MOT expiry/last-test detail lives in the collapsed dropdown
    // body, not the always-visible summary.
    expect(within(summary).queryByText('12 Aug 2026')).not.toBeInTheDocument()
  })

  it('expands a vehicle to show its MOT expiry and last test', async () => {
    serveAccount(ACCOUNT)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAccount()
    await expandVehicle(user)

    expect(screen.getByText('12 Aug 2026')).toBeInTheDocument()
    expect(screen.getByText('PASS · 12 Aug 2025')).toBeInTheDocument()
  })

  it('separates upcoming from past appointments by their start time', async () => {
    serveAccount({
      ...ACCOUNT,
      appointments: [
        appointment({ id: 'past', appointment_type_name: 'Last year’s MOT', start_time: '2025-07-01T09:00:00+01:00' }),
        appointment({ id: 'next', appointment_type_name: 'Full service', start_time: '2026-07-01T09:00:00+01:00' }),
      ],
    })
    renderAccount()
    await screen.findByRole('heading', { name: 'Hi Oliver' })

    const upcoming = screen.getByRole('heading', { name: 'Upcoming appointments' }).parentElement!
    expect(within(upcoming).getByText('Full service')).toBeInTheDocument()
    expect(within(upcoming).queryByText('Last year’s MOT')).not.toBeInTheDocument()

    const past = screen.getByRole('heading', { name: 'Past appointments' }).parentElement!
    expect(within(past).getByText('Last year’s MOT')).toBeInTheDocument()
  })

  it('keeps an appointment collapsed - and its detail unfetched - until expanded', async () => {
    serveAccount(ACCOUNT)
    let requested = false
    server.use(
      http.get('*/api/customer/appointments/a1', () => {
        requested = true
        return HttpResponse.json(appointmentDetail())
      }),
    )
    renderAccount()
    await screen.findByText('MOT test')

    expect(requested).toBe(false)
    expect(screen.queryByText('Annual statutory test.')).not.toBeInTheDocument()
  })

  it('expands an appointment to show its full detail inline, without navigating away', async () => {
    serveAccount(ACCOUNT)
    serveAppointmentDetail('a1', appointmentDetail())
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAccount()
    await user.click(await screen.findByText('MOT test'))

    expect(await screen.findByText('Annual statutory test.')).toBeInTheDocument()
    // "Bennett Motors" also appears in the page subtitle - the business name
    // on this appointment's own detail confirms the dropdown body rendered.
    expect(screen.getAllByText('Bennett Motors').length).toBeGreaterThan(1)
    // Still on the account page - this is a same-page dropdown, not a link.
    expect(screen.queryByRole('heading', { name: 'Customer sign in' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hi Oliver' })).toBeInTheDocument()
  })

  it('says so plainly when there is nothing on file', async () => {
    // A brand-new customer must see explanations, not three empty boxes.
    serveAccount({ ...ACCOUNT, vehicles: [], appointments: [] })
    renderAccount()
    expect(await screen.findByText('No vehicles on file.')).toBeInTheDocument()
    expect(screen.getByText('Nothing booked in.')).toBeInTheDocument()
    expect(screen.getByText('No past appointments.')).toBeInTheDocument()
  })

  it('renders a vehicle with no MOT history or mileage without breaking', async () => {
    serveAccount({
      ...ACCOUNT,
      vehicles: [
        vehicle({ make: null, model: null, year: null, current_mileage: null, mot_expiry_date: null, mot_records: [] }),
      ],
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAccount()
    await expandVehicle(user)
    const card = (await screen.findByText('OB08AUD')).closest('details') as HTMLElement

    // Both the badge and the expiry row degrade to "Unknown" rather than
    // rendering "null" or an empty cell.
    expect(within(card).getAllByText('Unknown')).toHaveLength(2)
    // Rows with nothing to say are omitted entirely.
    expect(within(card).queryByText('Last test')).not.toBeInTheDocument()
    expect(within(card).queryByText('Mileage on file')).not.toBeInTheDocument()
  })

  it('offers to create an account when no password is set yet', async () => {
    serveAccount(ACCOUNT)
    renderAccount()
    expect(await screen.findByText('Create an account')).toBeInTheDocument()
  })

  it('does not offer to create an account once a password is already set', async () => {
    serveAccount({ ...ACCOUNT, customer: { ...ACCOUNT.customer, has_password: true } })
    renderAccount()
    await screen.findByRole('heading', { name: 'Hi Oliver' })
    expect(screen.queryByText('Create an account')).not.toBeInTheDocument()
  })

  it('sets a password and confirms it worked', async () => {
    serveAccount(ACCOUNT)
    let body: unknown
    server.use(
      http.post('*/api/customer/auth/set-password', async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAccount()
    await screen.findByText('Create an account')

    await user.type(screen.getByLabelText('Password'), 'a-brand-new-password')
    await user.type(screen.getByLabelText('Confirm'), 'a-brand-new-password')
    await user.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText(/Password set/)).toBeInTheDocument()
    expect(body).toEqual({ password: 'a-brand-new-password' })
  })

  it('rejects mismatched passwords without calling the API', async () => {
    serveAccount(ACCOUNT)
    let posted = false
    server.use(
      http.post('*/api/customer/auth/set-password', () => {
        posted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAccount()
    await screen.findByText('Create an account')

    await user.type(screen.getByLabelText('Password'), 'a-brand-new-password')
    await user.type(screen.getByLabelText('Confirm'), 'does-not-match')
    await user.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(posted).toBe(false)
  })

  it('signs the customer out and returns them to sign-in', async () => {
    serveAccount(ACCOUNT)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAccount()
    await screen.findByRole('heading', { name: 'Hi Oliver' })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Customer sign in' })).toBeInTheDocument()
    expect(getCustomerAccessToken()).toBeNull()
  })

  it('has no detectable accessibility violations', async () => {
    serveAccount(ACCOUNT)
    const { container } = renderAccount()
    await screen.findByRole('heading', { name: 'Hi Oliver' })
    await expectNoA11yViolations(container)
  })
})
