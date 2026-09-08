import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeCustomer, makeVehicle } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { VehicleDetail } from './VehicleDetail'
import type { MOTRecord } from '../../types'
import { expectNoA11yViolations } from '../../test/a11y'

const record = (patch: Partial<MOTRecord> = {}): MOTRecord =>
  ({
    id: 'm1',
    garage_id: 'g1',
    vehicle_id: 'v1',
    mot_date: '2025-08-12',
    expiry_date: '2026-08-12',
    result: 'PASS',
    notes: null,
    created_at: '',
    updated_at: '',
    ...patch,
  }) as MOTRecord

function serveVehicle(vehicle = makeVehicle(), records: MOTRecord[] = []) {
  server.use(
    http.get('*/api/vehicles/:id', () => HttpResponse.json(vehicle)),
    http.get('*/api/customers/:id', () =>
      HttpResponse.json(makeCustomer({ id: 'c1', first_name: 'Oliver', last_name: 'Bennett' })),
    ),
    http.get('*/api/vehicles/:id/mot-records/', () => HttpResponse.json(records)),
  )
}

function renderDetail() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/vehicles/:id" element={<VehicleDetail />} />
      <Route path="/:garageId/vehicles" element={<h1>Vehicles list</h1>} />
    </Routes>,
    { route: '/g1/vehicles/v1' },
  )
}

// Deliberately no fake timers here. Toasts in this page auto-dismiss after
// 5s, and an auto-advancing fake clock can skip past that under load; the MOT
// status assertions use far-future/far-past dates instead, so they hold
// whatever the real date is. The status boundaries themselves are pinned in
// src/lib/mot.test.ts and src/components/MotBadge.test.tsx.
afterEach(() => vi.restoreAllMocks())

describe('VehicleDetail — the vehicle', () => {
  it('shows a loading state, then the vehicle', async () => {
    server.use(
      http.get('*/api/vehicles/:id', async () => {
        await delay(50)
        return HttpResponse.json(makeVehicle())
      }),
      http.get('*/api/vehicles/:id/mot-records/', () => HttpResponse.json([])),
      http.get('*/api/customers/:id', () => HttpResponse.json(makeCustomer())),
    )
    renderDetail()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'OB08AUD' })).toBeInTheDocument()
  })

  it('says the vehicle was not found rather than rendering an empty page', async () => {
    server.use(
      http.get('*/api/vehicles/:id', () =>
        HttpResponse.json({ code: 404, status: 'x' }, { status: 404 }),
      ),
      http.get('*/api/vehicles/:id/mot-records/', () => HttpResponse.json([])),
    )
    renderDetail()
    expect(await screen.findByText('Vehicle not found.')).toBeInTheDocument()
  })

  it('shows the vehicle’s details, MOT status and owner', async () => {
    serveVehicle(makeVehicle({ mot_expiry_date: '2099-08-12' }))
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'OB08AUD' })).toBeInTheDocument()
    expect(screen.getByText(/Audi A4 2018 · 40,000 mi/)).toBeInTheDocument()
    // The owner comes from a second query, so this waits rather than
    // assuming both resolved in the same tick.
    expect(await screen.findByRole('link', { name: 'Oliver Bennett' })).toHaveAttribute(
      'href',
      '/g1/customers/c1',
    )
    expect(screen.getByText('Valid')).toBeInTheDocument()
    expect(screen.getByText(/12 Aug 2099/)).toBeInTheDocument()
  })

  it('degrades gracefully when nothing optional is on file', async () => {
    serveVehicle(
      makeVehicle({ make: null, model: null, year: null, current_mileage: null, mot_expiry_date: null }),
    )
    renderDetail()
    expect(await screen.findByText('No details')).toBeInTheDocument()
    // Both the summary line and the empty history say so, rather than showing
    // a blank date.
    expect(screen.getAllByText(/No MOT records yet/)).toHaveLength(2)
  })

  it('marks an archived vehicle as archived', async () => {
    serveVehicle(makeVehicle({ is_active: false }))
    renderDetail()
    expect(await screen.findByText('Archived')).toBeInTheDocument()
  })
})

describe('VehicleDetail — MOT history', () => {
  it('says so when there is no history yet', async () => {
    serveVehicle(makeVehicle(), [])
    renderDetail()
    expect(await screen.findByText('No MOT records yet.')).toBeInTheDocument()
  })

  it('lists records newest first, whatever order they arrive in', async () => {
    serveVehicle(makeVehicle(), [
      record({ id: 'old', mot_date: '2023-08-12', expiry_date: '2024-08-12' }),
      record({ id: 'new', mot_date: '2025-08-12', expiry_date: '2026-08-12', notes: 'Advisory: tyres' }),
    ])
    renderDetail()

    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('12 Aug 2025')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Advisory: tyres')).toBeInTheDocument()
    expect(within(rows[2]).getByText('12 Aug 2023')).toBeInTheDocument()
  })

  it('shows a placeholder for a record with no notes', async () => {
    serveVehicle(makeVehicle(), [record({ notes: null })])
    renderDetail()
    const rows = await screen.findAllByRole('row')
    expect(within(rows[1]).getByText('—')).toBeInTheDocument()
  })
})

describe('VehicleDetail — adding an MOT record', () => {
  const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByRole('heading', { name: 'OB08AUD' })
    await user.click(screen.getByRole('button', { name: 'Add MOT record' }))
  }

  it('opens and closes the record form', async () => {
    serveVehicle()
    const user = userEvent.setup()
    renderDetail()
    await openForm(user)
    expect(screen.getByLabelText('MOT date')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('MOT date')).not.toBeInTheDocument()
  })

  it('records a pass with its new expiry date', async () => {
    serveVehicle()
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/vehicles/:id/mot-records/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(record())
      }),
    )
    const user = userEvent.setup()
    renderDetail()
    await openForm(user)

    await user.type(screen.getByLabelText('MOT date'), '2026-06-01')
    await user.type(screen.getByLabelText('Expiry date'), '2027-06-01')
    await user.type(screen.getByLabelText('Notes'), 'All good.')
    await user.click(screen.getByRole('button', { name: 'Save record' }))

    expect(await screen.findByText('MOT record added.')).toBeInTheDocument()
    expect(body).toEqual({
      mot_date: '2026-06-01',
      expiry_date: '2027-06-01',
      result: 'PASS',
      notes: 'All good.',
    })
  })

  it('disables the expiry date for a fail, and sends no expiry', async () => {
    // A failed test never grants a new expiry — the field is not merely
    // ignored, it is taken out of the user's hands.
    serveVehicle()
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/vehicles/:id/mot-records/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(record({ result: 'FAIL' }))
      }),
    )
    const user = userEvent.setup()
    renderDetail()
    await openForm(user)

    await user.type(screen.getByLabelText('MOT date'), '2026-06-01')
    await user.type(screen.getByLabelText('Expiry date'), '2027-06-01')
    await user.selectOptions(screen.getByLabelText('Result'), 'FAIL')

    const expiry = screen.getByLabelText('Expiry date')
    expect(expiry).toBeDisabled()
    expect(expiry).toHaveValue('')
    expect(screen.getByText(/doesn't grant a new expiry/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save record' }))
    await waitFor(() => expect(body.expiry_date).toBeNull())
    expect(body.result).toBe('FAIL')
  })

  it('will not submit a pass without both dates', async () => {
    serveVehicle()
    let posted = false
    server.use(
      http.post('*/api/vehicles/:id/mot-records/', () => {
        posted = true
        return HttpResponse.json(record())
      }),
    )
    const user = userEvent.setup()
    renderDetail()
    await openForm(user)
    await user.click(screen.getByRole('button', { name: 'Save record' }))

    expect(posted).toBe(false)
    expect(screen.getByLabelText('MOT date')).toBeInvalid()
  })

  it('shows the server’s field errors against the dates', async () => {
    serveVehicle()
    server.use(
      http.post('*/api/vehicles/:id/mot-records/', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'x',
            errors: { json: { expiry_date: ['Expiry must be after the MOT date.'] } },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderDetail()
    await openForm(user)
    await user.type(screen.getByLabelText('MOT date'), '2026-06-01')
    await user.type(screen.getByLabelText('Expiry date'), '2025-06-01')
    await user.click(screen.getByRole('button', { name: 'Save record' }))

    expect(await screen.findByText('Expiry must be after the MOT date.')).toBeInTheDocument()
    // Form stays open with the values intact so they can be corrected.
    expect(screen.getByLabelText('MOT date')).toHaveValue('2026-06-01')
  })

  it('shows a form-level message for a server failure', async () => {
    serveVehicle()
    server.use(
      http.post('*/api/vehicles/:id/mot-records/', () =>
        HttpResponse.json({ code: 500, status: 'x', message: 'Could not save.' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderDetail()
    await openForm(user)
    await user.type(screen.getByLabelText('MOT date'), '2026-06-01')
    await user.type(screen.getByLabelText('Expiry date'), '2027-06-01')
    await user.click(screen.getByRole('button', { name: 'Save record' }))

    expect(await screen.findByText('Could not save.')).toBeInTheDocument()
  })
})

describe('VehicleDetail — deleting', () => {
  it('asks for confirmation and does nothing when declined', async () => {
    serveVehicle()
    let deletes = 0
    server.use(
      http.delete('*/api/vehicles/:id', () => {
        deletes++
        return HttpResponse.json({ archived: false })
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: 'OB08AUD' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deletes).toBe(0)
    expect(screen.getByRole('heading', { name: 'OB08AUD' })).toBeInTheDocument()
  })

  it('deletes once confirmed and returns to the list', async () => {
    serveVehicle()
    server.use(http.delete('*/api/vehicles/:id', () => HttpResponse.json({ archived: false })))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: 'OB08AUD' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Vehicle deleted.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vehicles list' })).toBeInTheDocument()
  })

  it('explains when the vehicle was archived instead of deleted', async () => {
    // Silently saying "deleted" for a vehicle that is still findable would
    // mislead staff about what actually happened.
    serveVehicle()
    server.use(http.delete('*/api/vehicles/:id', () => HttpResponse.json({ archived: true })))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: 'OB08AUD' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(
      await screen.findByText(/has MOT history or appointments on file, so it was archived/),
    ).toBeInTheDocument()
  })

  it('reports a failed delete instead of appearing to succeed', async () => {
    serveVehicle()
    server.use(
      http.delete('*/api/vehicles/:id', () =>
        HttpResponse.json({ code: 403, status: 'x', message: 'Not permitted.' }, { status: 403 }),
      ),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderDetail()
    await screen.findByRole('heading', { name: 'OB08AUD' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Not permitted.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'OB08AUD' })).toBeInTheDocument()
  })
})

describe('VehicleDetail — accessibility', () => {
  it('has no detectable violations, with the record form open', async () => {
    serveVehicle(makeVehicle(), [record()])
    const user = userEvent.setup()
    const { container } = renderDetail()
    await screen.findByRole('heading', { name: 'OB08AUD' })
    await user.click(screen.getByRole('button', { name: 'Add MOT record' }))
    await expectNoA11yViolations(container)
  })
})
