import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { server } from '../test/msw/server'
import {
  makeAppointment,
  makeAppointmentType,
  makeCustomer,
  makeGarage,
  makeGarageStatus,
} from '../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../test/utils'
import { Dashboard } from './Dashboard'
import { expectNoA11yViolations } from '../test/a11y'

// Today's appointments are queried by today's date, so the clock is pinned.
const TODAY = '2026-09-14'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T08:00:00+01:00`))
})
afterEach(() => vi.useRealTimers())

function renderDashboard() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/dashboard" element={<Dashboard />} />
    </Routes>,
    { route: '/g1/dashboard' },
  )
}

const at = (start: string, end: string, patch = {}) =>
  makeAppointment({
    start_time: `${TODAY}T${start}:00+01:00`,
    end_time: `${TODAY}T${end}:00+01:00`,
    ...patch,
  })

describe('Dashboard — capacity', () => {
  it('welcomes the user by their garage’s name', async () => {
    server.use(http.get('*/api/garage', () => HttpResponse.json(makeGarage({ name: 'Vale Autos' }))))
    renderDashboard()
    expect(await screen.findByRole('heading', { name: 'Vale Autos' })).toBeInTheDocument()
  })

  it('shows today’s and this week’s booked time against capacity', async () => {
    server.use(
      http.get('*/api/garage/capacity/summary', () =>
        HttpResponse.json({
          today: { booked_minutes: 90, capacity_minutes: 480, level: 'green' },
          week: { booked_minutes: 1500, capacity_minutes: 2400, level: 'amber' },
        }),
      ),
    )
    renderDashboard()

    const today = (await screen.findByText("Today's booked time")).closest('a')!
    expect(today).toHaveTextContent('1h 30m')
    expect(today).toHaveTextContent('8h')
    expect(today).toHaveTextContent('Available')

    const week = screen.getByText("This week's booked time").closest('a')!
    expect(week).toHaveTextContent('Filling up')
  })

  it('shows placeholders, not zeroes, while capacity is unknown', async () => {
    // "0h / 0h" would read as "no capacity configured", which is a different fact.
    server.use(
      http.get('*/api/garage/capacity/summary', () =>
        HttpResponse.json({ code: 500, status: 'x' }, { status: 500 }),
      ),
    )
    renderDashboard()

    const today = (await screen.findByText("Today's booked time")).closest('a')!
    expect(today).toHaveTextContent('— / —')
    expect(today).not.toHaveTextContent('0h')
    // No capacity level means no colour-coded verdict either — just the link.
    expect(today).toHaveTextContent('View diary →')
    expect(today).not.toHaveTextContent('Available')
  })

  it('links each capacity card at the matching diary view', async () => {
    renderDashboard()
    const today = (await screen.findByText("Today's booked time")).closest('a')!
    expect(today).toHaveAttribute('href', `/g1/appointments?view=day&date=${TODAY}`)
    expect(screen.getByText("This week's booked time").closest('a')).toHaveAttribute(
      'href',
      '/g1/appointments?view=week',
    )
  })
})

describe('Dashboard — pending booking requests', () => {
  it('flags requests waiting for review, with a link to triage them', async () => {
    server.use(
      http.get('*/api/booking-requests/', () => HttpResponse.json([{ id: 'br1' }, { id: 'br2' }])),
    )
    renderDashboard()
    expect(await screen.findByText('2 public booking requests waiting for review')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review requests' })).toHaveAttribute(
      'href',
      '/g1/booking-requests',
    )
  })

  it('uses the singular for exactly one request', async () => {
    server.use(http.get('*/api/booking-requests/', () => HttpResponse.json([{ id: 'br1' }])))
    renderDashboard()
    expect(await screen.findByText('1 public booking request waiting for review')).toBeInTheDocument()
  })

  it('shows no banner when nothing is waiting', async () => {
    server.use(http.get('*/api/booking-requests/', () => HttpResponse.json([])))
    renderDashboard()
    await screen.findByRole('heading', { name: /welcome/i })
    expect(screen.queryByText(/waiting for review/)).not.toBeInTheDocument()
  })
})

describe("Dashboard — today's appointments", () => {
  it('says so plainly when nothing is booked today', async () => {
    server.use(http.get('*/api/appointments/', () => HttpResponse.json([])))
    renderDashboard()
    expect(await screen.findByText('Nothing booked for today.')).toBeInTheDocument()
  })

  it('lists today’s appointments in start-time order, whatever order they arrive in', async () => {
    server.use(
      http.get('*/api/appointments/', () =>
        HttpResponse.json([
          at('15:00', '16:00', { id: 'late', customer_id: 'c2' }),
          at('09:00', '10:00', { id: 'early', customer_id: 'c1' }),
        ]),
      ),
      http.get('*/api/customers/', () =>
        HttpResponse.json([
          makeCustomer({ id: 'c1', first_name: 'Oliver', last_name: 'Bennett' }),
          makeCustomer({ id: 'c2', first_name: 'Nadia', last_name: 'Okafor' }),
        ]),
      ),
    )
    renderDashboard()

    const items = await screen.findAllByRole('listitem')
    expect(within(items[0]).getByText('Oliver Bennett')).toBeInTheDocument()
    expect(within(items[1]).getByText('Nadia Okafor')).toBeInTheDocument()
  })

  it('shows each appointment’s time range and service, linked to its overview', async () => {
    server.use(
      http.get('*/api/appointments/', () => HttpResponse.json([at('09:00', '10:30', { id: 'a1' })])),
      http.get('*/api/appointment-types/', () =>
        HttpResponse.json([makeAppointmentType({ id: 'at1', name: 'Full service' })]),
      ),
    )
    renderDashboard()

    const link = await screen.findByRole('link', { name: /Oliver Bennett/ })
    expect(link).toHaveAttribute('href', '/g1/appointments/a1/overview')
    expect(link).toHaveTextContent('09:00 – 10:30')
    expect(link).toHaveTextContent('Full service')
  })

  it('degrades gracefully when the customer or service cannot be resolved', async () => {
    // Both lists are separate queries; the diary must still render if one is
    // empty or slow.
    server.use(
      http.get('*/api/appointments/', () =>
        HttpResponse.json([at('09:00', '10:00', { customer_id: 'ghost', appointment_type_id: 'gone' })]),
      ),
      http.get('*/api/customers/', () => HttpResponse.json([])),
      http.get('*/api/appointment-types/', () => HttpResponse.json([])),
    )
    renderDashboard()
    expect(await screen.findByText('Unknown customer')).toBeInTheDocument()
  })

  it('prefers the garage’s own status labels over the built-in ones', async () => {
    server.use(
      http.get('*/api/appointments/', () => HttpResponse.json([at('09:00', '10:00')])),
      http.get('*/api/appointment-statuses/', () =>
        HttpResponse.json([makeGarageStatus({ key: 'BOOKED', label: 'On the ramp' })]),
      ),
    )
    renderDashboard()
    expect(await screen.findByText('On the ramp')).toBeInTheDocument()
    expect(screen.queryByText('Booked')).not.toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    server.use(http.get('*/api/appointments/', () => HttpResponse.json([at('09:00', '10:00')])))
    const { container } = renderDashboard()
    await screen.findByRole('heading', { name: /welcome/i })
    await expectNoA11yViolations(container)
  })
})
