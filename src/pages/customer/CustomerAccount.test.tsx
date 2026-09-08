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
  status: 'BOOKED',
  vehicle_registration: 'OB08AUD',
  ...patch,
})

function serveAccount(body: unknown) {
  server.use(http.get('*/api/customer/account', () => HttpResponse.json(body)))
}

const ACCOUNT = {
  customer: { first_name: 'Oliver', garage_name: 'Bennett Motors' },
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

  it('shows each vehicle with its MOT status and last test', async () => {
    serveAccount(ACCOUNT)
    renderAccount()
    expect(await screen.findByText('OB08AUD')).toBeInTheDocument()
    expect(screen.getByText('Audi A4 2018')).toBeInTheDocument()
    expect(screen.getByText('12 Aug 2026')).toBeInTheDocument()
    expect(screen.getByText('PASS · 12 Aug 2025')).toBeInTheDocument()
    // Expires 2026-08-12, ~58 days after the pinned "now".
    expect(screen.getByText('Valid')).toBeInTheDocument()
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

  it('links each appointment to its own detail page', async () => {
    serveAccount(ACCOUNT)
    renderAccount()
    expect(await screen.findByRole('link', { name: /MOT test/ })).toHaveAttribute(
      'href',
      '/customer/appointments/a1',
    )
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
    renderAccount()
    const card = (await screen.findByText('OB08AUD')).closest('div.rounded-lg') as HTMLElement

    // Both the badge and the expiry row degrade to "Unknown" rather than
    // rendering "null" or an empty cell.
    expect(within(card).getAllByText('Unknown')).toHaveLength(2)
    // Rows with nothing to say are omitted entirely.
    expect(within(card).queryByText('Last test')).not.toBeInTheDocument()
    expect(within(card).queryByText('Mileage on file')).not.toBeInTheDocument()
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
