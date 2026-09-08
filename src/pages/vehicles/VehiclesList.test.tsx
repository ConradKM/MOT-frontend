import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeCustomer, makeVehicle } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { VehiclesList } from './VehiclesList'
import { expectNoA11yViolations } from '../../test/a11y'

const CUSTOMERS = [
  makeCustomer({ id: 'c1', first_name: 'Oliver', last_name: 'Bennett' }),
  makeCustomer({ id: 'c2', first_name: 'Nadia', last_name: 'Okafor' }),
]

/** Serves /api/vehicles/ and records the query string of each request, so a
 * test can assert the *filter* reached the API rather than re-testing filtering. */
function serveVehicles(rows = [makeVehicle()]) {
  const queries: URLSearchParams[] = []
  server.use(
    http.get('*/api/customers/', () => HttpResponse.json(CUSTOMERS)),
    http.get('*/api/vehicles/', ({ request }) => {
      queries.push(new URL(request.url).searchParams)
      return HttpResponse.json(rows)
    }),
  )
  return queries
}

function renderList() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/vehicles" element={<VehiclesList />} />
    </Routes>,
    { route: '/g1/vehicles' },
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('VehiclesList — API states', () => {
  it('shows a loading message first', async () => {
    server.use(
      http.get('*/api/vehicles/', async () => {
        await delay(50)
        return HttpResponse.json([makeVehicle()])
      }),
    )
    renderList()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('shows the vehicles once they arrive', async () => {
    serveVehicles([
      makeVehicle({ id: 'v1', registration_number: 'OB08AUD', mot_expiry_date: '2026-06-01' }),
    ])
    renderList()

    const row = (await screen.findByRole('link', { name: 'OB08AUD' })).closest('tr')!
    expect(within(row).getByText('Audi A4')).toBeInTheDocument()
    expect(within(row).getByText('Oliver Bennett')).toBeInTheDocument()
    expect(within(row).getByText('1 Jun 2026')).toBeInTheDocument()
    expect(within(row).getByText('Expired')).toBeInTheDocument()
  })

  it('says the list is empty rather than showing an empty table', async () => {
    serveVehicles([])
    renderList()
    expect(await screen.findByText('No vehicles found.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it.each([400, 403, 404, 500])('shows an error message for a %i', async (status) => {
    server.use(
      http.get('*/api/vehicles/', () => HttpResponse.json({ code: status, status: 'x' }, { status })),
    )
    renderList()
    expect(await screen.findByText('Failed to load vehicles.')).toBeInTheDocument()
  })

  it('shows an error message when the network fails', async () => {
    server.use(http.get('*/api/vehicles/', () => HttpResponse.error()))
    renderList()
    expect(await screen.findByText('Failed to load vehicles.')).toBeInTheDocument()
  })

  it('shows an error message when the response is not the JSON it expected', async () => {
    // A misconfigured proxy returning an HTML page must not white-screen the app.
    server.use(http.get('*/api/vehicles/', () => new HttpResponse('<html>oops</html>')))
    renderList()
    expect(await screen.findByText('Failed to load vehicles.')).toBeInTheDocument()
  })

  it('still renders a vehicle whose optional details are all missing', async () => {
    serveVehicles([
      makeVehicle({ make: null, model: null, mot_expiry_date: null, customer_id: 'unknown-c' }),
    ])
    renderList()

    const row = (await screen.findByRole('link', { name: 'OB08AUD' })).closest('tr')!
    expect(within(row).getAllByText('—')).toHaveLength(2) // make/model and expiry
    expect(within(row).getByText('Unknown')).toBeInTheDocument()
    // An id with no matching customer is shown as an id, not as "undefined".
    expect(within(row).getByText('#unknown-c')).toBeInTheDocument()
  })
})

describe('VehiclesList — filtering', () => {
  it('passes a registration search to the API', async () => {
    const queries = serveVehicles()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderList()
    await screen.findByRole('table')

    await user.type(screen.getByPlaceholderText('Registration…'), 'OB08')
    await waitFor(() => expect(queries.at(-1)?.get('registration')).toBe('OB08'))
  })

  it('passes a customer filter to the API', async () => {
    const queries = serveVehicles()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderList()
    await screen.findByRole('option', { name: 'Nadia Okafor' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by customer' }), 'c2')
    await waitFor(() => expect(queries.at(-1)?.get('customer_id')).toBe('c2'))
  })

  it('sends no filter parameters when the boxes are empty', async () => {
    const queries = serveVehicles()
    renderList()
    await screen.findByRole('table')
    expect([...(queries[0]?.keys() ?? [])]).toEqual([])
  })

  it('offers a clear-filters control only once something is filtered', async () => {
    serveVehicles()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderList()
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Registration…'), 'OB08')
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

    expect(screen.getByPlaceholderText('Registration…')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('reports no results for a filter that matches nothing', async () => {
    server.use(
      http.get('*/api/customers/', () => HttpResponse.json(CUSTOMERS)),
      http.get('*/api/vehicles/', ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.has('registration') ? [] : [makeVehicle()]),
      ),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderList()
    await screen.findByRole('table')

    await user.type(screen.getByPlaceholderText('Registration…'), 'ZZ99ZZZ')
    expect(await screen.findByText('No vehicles found.')).toBeInTheDocument()
  })
})

describe('VehiclesList — navigation and accessibility', () => {
  it('links each registration to its vehicle, and offers a create action', async () => {
    serveVehicles()
    renderList()
    expect(await screen.findByRole('link', { name: 'OB08AUD' })).toHaveAttribute(
      'href',
      '/g1/vehicles/v1',
    )
    expect(screen.getByRole('link', { name: 'New vehicle' })).toHaveAttribute(
      'href',
      '/g1/vehicles/new',
    )
  })

  it('has no detectable accessibility violations', async () => {
    serveVehicles()
    const { container } = renderList()
    await screen.findByRole('table')
    await expectNoA11yViolations(container)
  })
})
