import { describe, expect, it } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeCustomer, makeVehicle } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { VehicleForm } from './VehicleForm'

const CUSTOMERS = [
  makeCustomer({ id: 'c1', first_name: 'Oliver', last_name: 'Bennett' }),
  makeCustomer({ id: 'c2', first_name: 'Nadia', last_name: 'Okafor' }),
]

function renderForm(route = '/g1/vehicles/new') {
  signInAsStaff()
  server.use(http.get('*/api/customers/', () => HttpResponse.json(CUSTOMERS)))
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/vehicles/new" element={<VehicleForm />} />
      <Route path="/:garageId/vehicles/:id/edit" element={<VehicleForm />} />
      <Route path="/:garageId/vehicles/:id" element={<h1>Vehicle detail</h1>} />
    </Routes>,
    { route },
  )
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole('option', { name: 'Oliver Bennett' })).toBeInTheDocument())
  await user.selectOptions(screen.getByLabelText('Customer'), 'c1')
  await user.type(screen.getByLabelText('Registration number'), 'OB08AUD')
}

describe('VehicleForm — the customer select', () => {
  it('offers each of the garage’s customers by name', async () => {
    renderForm()
    expect(await screen.findByRole('option', { name: 'Oliver Bennett' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Nadia Okafor' })).toBeInTheDocument()
  })

  it('starts on a disabled placeholder so a customer must be chosen', async () => {
    renderForm()
    await screen.findByRole('option', { name: 'Oliver Bennett' })
    expect(screen.getByLabelText('Customer')).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Select a customer' })).toBeDisabled()
  })

  it('preselects the customer when arriving from their detail page', async () => {
    renderForm('/g1/vehicles/new?customer_id=c2')
    await waitFor(() => expect(screen.getByLabelText('Customer')).toHaveValue('c2'))
  })
})

describe('VehicleForm — validation', () => {
  it('will not submit without a customer and a registration', async () => {
    let posted = false
    server.use(
      http.post('*/api/vehicles/', () => {
        posted = true
        return HttpResponse.json(makeVehicle())
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('option', { name: 'Oliver Bennett' })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(posted).toBe(false)
    expect(screen.getByLabelText('Customer')).toBeInvalid()
  })

  it('will not submit with a customer but no registration', async () => {
    let posted = false
    server.use(
      http.post('*/api/vehicles/', () => {
        posted = true
        return HttpResponse.json(makeVehicle())
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('option', { name: 'Oliver Bennett' })
    await user.selectOptions(screen.getByLabelText('Customer'), 'c1')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(posted).toBe(false)
    expect(screen.getByLabelText('Registration number')).toBeInvalid()
  })

  it('refuses a negative mileage at the control itself', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    expect(screen.getByLabelText('Current mileage')).toHaveAttribute('min', '0')
  })
})

describe('VehicleForm — submitting', () => {
  it('sends numbers as numbers and blank optionals as null', async () => {
    // The backend types year/mileage as integers; sending "2018" as a string
    // would be rejected.
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/vehicles/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeVehicle({ id: 'v9' }))
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.type(screen.getByLabelText('Year'), '2018')
    await user.type(screen.getByLabelText('Current mileage'), '40000')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('heading', { name: 'Vehicle detail' })
    expect(body).toEqual({
      customer_id: 'c1',
      registration_number: 'OB08AUD',
      make: null,
      model: null,
      year: 2018,
      current_mileage: 40000,
      mot_expiry_date: null,
    })
  })

  it('treats a zero mileage as a real value, not as "blank"', async () => {
    // 0 miles is legitimate for a brand-new vehicle; a falsy check would drop it.
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/vehicles/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeVehicle({ id: 'v9' }))
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.type(screen.getByLabelText('Current mileage'), '0')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(body.current_mileage).toBe(0))
  })

  it('confirms creation with a toast and opens the new vehicle', async () => {
    server.use(http.post('*/api/vehicles/', () => HttpResponse.json(makeVehicle({ id: 'v9' }))))
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Vehicle created.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vehicle detail' })).toBeInTheDocument()
  })

  it('surfaces a duplicate registration as a field error', async () => {
    server.use(
      http.post('*/api/vehicles/', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'x',
            errors: { json: { registration_number: ['This registration is already on file.'] } },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('This registration is already on file.')).toBeInTheDocument()
    expect(screen.getByLabelText('Registration number')).toHaveValue('OB08AUD')
  })

  it('surfaces a server failure as a form-level message', async () => {
    server.use(
      http.post('*/api/vehicles/', () =>
        HttpResponse.json({ code: 500, status: 'x', message: 'Database unavailable.' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Database unavailable.')).toBeInTheDocument()
  })

  it('saves only once when the button is clicked repeatedly', async () => {
    let posts = 0
    server.use(
      http.post('*/api/vehicles/', async () => {
        posts++
        await delay(30)
        return HttpResponse.json(makeVehicle({ id: 'v9' }))
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.tripleClick(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('heading', { name: 'Vehicle detail' })
    expect(posts).toBe(1)
  })
})

describe('VehicleForm — editing', () => {
  it('loads the vehicle, rendering absent optional fields as blank', async () => {
    server.use(
      http.get('*/api/vehicles/:id', () =>
        HttpResponse.json(
          makeVehicle({
            id: 'v1',
            registration_number: 'NA11DIA',
            make: null,
            model: null,
            year: null,
            current_mileage: null,
            mot_expiry_date: null,
          }),
        ),
      ),
    )
    renderForm('/g1/vehicles/v1/edit')
    expect(screen.getByRole('heading', { name: 'Edit vehicle' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByLabelText('Registration number')).toHaveValue('NA11DIA'),
    )
    expect(screen.getByLabelText('Make')).toHaveValue('')
    expect(screen.getByLabelText('Year')).toHaveValue(null)
    expect(screen.getByLabelText(/MOT expiry date/)).toHaveValue('')
  })
})
