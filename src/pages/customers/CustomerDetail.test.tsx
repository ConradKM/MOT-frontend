import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeCustomer, makeVehicle } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { CustomerDetail } from './CustomerDetail'
import { expectNoA11yViolations } from '../../test/a11y'

function serveCustomer(
  customer = makeCustomer(),
  vehicles = [makeVehicle()],
  communications: unknown[] = [],
) {
  const vehicleQueries: URLSearchParams[] = []
  server.use(
    http.get('*/api/customers/:id/communications', () => HttpResponse.json(communications)),
    http.get('*/api/customers/:id', () => HttpResponse.json(customer)),
    http.get('*/api/vehicles/', ({ request }) => {
      vehicleQueries.push(new URL(request.url).searchParams)
      return HttpResponse.json(vehicles)
    }),
  )
  return vehicleQueries
}

function renderDetail() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/customers/:id" element={<CustomerDetail />} />
      <Route path="/:garageId/customers" element={<h1>Customers list</h1>} />
    </Routes>,
    { route: '/g1/customers/c1' },
  )
}

afterEach(() => vi.restoreAllMocks())

describe('CustomerDetail — the customer', () => {
  it('shows a loading state, then the customer', async () => {
    server.use(
      http.get('*/api/customers/:id/communications', () => HttpResponse.json([])),
      http.get('*/api/customers/:id', async () => {
        await delay(50)
        return HttpResponse.json(makeCustomer())
      }),
    )
    renderDetail()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Oliver Bennett' })).toBeInTheDocument()
  })

  it('says the customer was not found rather than rendering an empty page', async () => {
    server.use(
      http.get('*/api/customers/:id/communications', () => HttpResponse.json([])),
      http.get('*/api/customers/:id', () =>
        HttpResponse.json({ code: 404, status: 'x' }, { status: 404 }),
      ),
    )
    renderDetail()
    expect(await screen.findByText('Customer not found.')).toBeInTheDocument()
  })

  it('shows placeholders instead of blanks for missing contact details', async () => {
    serveCustomer(makeCustomer({ email: null, phone: null }))
    renderDetail()
    await screen.findByRole('heading', { name: 'Oliver Bennett' })
    expect(screen.getByText(/No email · No phone/)).toBeInTheDocument()
  })

  it('marks an archived customer as archived', async () => {
    serveCustomer(makeCustomer({ is_active: false }))
    renderDetail()
    expect(await screen.findByText('Archived')).toBeInTheDocument()
  })
})

describe('CustomerDetail — their vehicles', () => {
  it('asks for archived vehicles too, so their history stays visible here', async () => {
    // Deliberately different from the garage-wide list, which hides them.
    const queries = serveCustomer()
    renderDetail()
    await screen.findByRole('heading', { name: 'Oliver Bennett' })
    expect(queries[0]?.get('include_inactive')).toBe('true')
    expect(queries[0]?.get('customer_id')).toBe('c1')
  })

  it('lists each vehicle, flagging archived ones', async () => {
    serveCustomer(makeCustomer(), [
      makeVehicle({ id: 'v1', registration_number: 'OB08AUD', mot_expiry_date: '2026-08-12' }),
      makeVehicle({ id: 'v2', registration_number: 'OB11KWY', is_active: false, make: null, model: null, mot_expiry_date: null }),
    ])
    renderDetail()

    const live = (await screen.findByRole('link', { name: 'OB08AUD' })).closest('tr')!
    expect(within(live).getByText('Audi A4')).toBeInTheDocument()
    expect(within(live).getByText('12 Aug 2026')).toBeInTheDocument()
    expect(within(live).queryByText('Archived')).not.toBeInTheDocument()

    const archived = screen.getByRole('link', { name: 'OB11KWY' }).closest('tr')!
    expect(within(archived).getByText('Archived')).toBeInTheDocument()
    expect(within(archived).getAllByText('—')).toHaveLength(2)
  })

  it('says so when the customer has no vehicles, and offers to add one', async () => {
    serveCustomer(makeCustomer(), [])
    renderDetail()
    expect(await screen.findByText('No vehicles on file.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add vehicle' })).toHaveAttribute(
      'href',
      '/g1/vehicles/new?customer_id=c1',
    )
  })
})

describe('CustomerDetail — communications history', () => {
  it('says so when there has been no contact yet', async () => {
    serveCustomer(makeCustomer(), [], [])
    renderDetail()
    expect(
      await screen.findByText('No calls or WhatsApp messages with this customer yet.'),
    ).toBeInTheDocument()
  })

  it('shows calls and WhatsApp messages with their direction and outcome', async () => {
    serveCustomer(makeCustomer(), [], [
      {
        id: 'x1',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        body: 'Can I move my booking?',
        status: 'DELIVERED',
        created_at: '2026-09-01T09:00:00+01:00',
      },
      {
        id: 'x2',
        channel: 'CALL',
        direction: 'OUTBOUND',
        body: null,
        status: 'COMPLETED',
        created_at: '2026-09-01T10:00:00+01:00',
      },
    ])
    renderDetail()

    expect(await screen.findByText(/WhatsApp · Incoming/)).toBeInTheDocument()
    expect(screen.getByText(/Can I move my booking\?/)).toBeInTheDocument()
    expect(screen.getByText(/Phone · Outgoing/)).toBeInTheDocument()
  })
})

describe('CustomerDetail — deleting', () => {
  it('asks for confirmation and does nothing when declined', async () => {
    serveCustomer()
    let deletes = 0
    server.use(
      http.delete('*/api/customers/:id', () => {
        deletes++
        return HttpResponse.json({ archived: false })
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: 'Oliver Bennett' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deletes).toBe(0)
  })

  it('deletes once confirmed and returns to the list', async () => {
    serveCustomer()
    server.use(http.delete('*/api/customers/:id', () => HttpResponse.json({ archived: false })))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: 'Oliver Bennett' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Customer deleted.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Customers list' })).toBeInTheDocument()
  })

  it('explains when the customer was archived instead of deleted', async () => {
    serveCustomer()
    server.use(http.delete('*/api/customers/:id', () => HttpResponse.json({ archived: true })))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: 'Oliver Bennett' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(
      await screen.findByText(/has vehicles or appointments on file, so they were archived/),
    ).toBeInTheDocument()
  })

  it('reports a failed delete instead of appearing to succeed', async () => {
    serveCustomer()
    server.use(
      http.delete('*/api/customers/:id', () =>
        HttpResponse.json({ code: 403, status: 'x', message: 'Not permitted.' }, { status: 403 }),
      ),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: 'Oliver Bennett' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Not permitted.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Oliver Bennett' })).toBeInTheDocument()
  })
})

describe('CustomerDetail — accessibility', () => {
  it('has no detectable violations', async () => {
    serveCustomer()
    const { container } = renderDetail()
    await screen.findByRole('heading', { name: 'Oliver Bennett' })
    await expectNoA11yViolations(container)
  })
})
