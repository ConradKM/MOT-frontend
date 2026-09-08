import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import {
  makeAppointment,
  makeAppointmentType,
  makeCustomer,
  makeEmployee,
  makeGarageStatus,
  makeVehicle,
} from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { AppointmentForm } from './AppointmentForm'

const EMPLOYEES = [makeEmployee({ id: 'e1', email: 'greg@bennett.example' })]
const CUSTOMERS = [
  makeCustomer({ id: 'c1', first_name: 'Oliver', last_name: 'Bennett' }),
  makeCustomer({ id: 'c2', first_name: 'Nadia', last_name: 'Okafor' }),
]
const VEHICLES = [
  makeVehicle({ id: 'v1', customer_id: 'c1', registration_number: 'OB08AUD' }),
  makeVehicle({ id: 'v2', customer_id: 'c2', registration_number: 'NA11DIA' }),
]
const TYPES = [
  makeAppointmentType({ id: 'at1', name: 'MOT test', base_price: '54.85' }),
  makeAppointmentType({ id: 'at2', name: 'Full service', base_price: '180.00' }),
]

function serveLookups(appointments = [makeAppointment()]) {
  server.use(
    http.get('*/api/employees/', () => HttpResponse.json(EMPLOYEES)),
    http.get('*/api/customers/', () => HttpResponse.json(CUSTOMERS)),
    http.get('*/api/vehicles/', () => HttpResponse.json(VEHICLES)),
    http.get('*/api/appointment-types/', () => HttpResponse.json(TYPES)),
    http.get('*/api/appointments/', () => HttpResponse.json(appointments)),
  )
}

function renderForm(route = '/g1/appointments/new') {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/appointments/new" element={<AppointmentForm />} />
      <Route path="/:garageId/appointments/:id/edit" element={<AppointmentForm />} />
      <Route path="/:garageId/appointments" element={<h1>Diary</h1>} />
    </Routes>,
    { route },
  )
}

/** Pick an option out of one of the page's RichDropdown comboboxes. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  field: string,
  optionName: RegExp,
) {
  await user.click(screen.getByRole('combobox', { name: new RegExp(field) }))
  await user.click(await screen.findByRole('option', { name: optionName }))
}

afterEach(() => vi.restoreAllMocks())

describe('AppointmentForm — creating', () => {
  it('defaults the type to the garage’s first active one rather than leaving it blank', async () => {
    serveLookups()
    renderForm()
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('MOT test'),
    )
  })

  it('disables the type picker and explains why when none are set up', async () => {
    server.use(
      http.get('*/api/employees/', () => HttpResponse.json(EMPLOYEES)),
      http.get('*/api/customers/', () => HttpResponse.json(CUSTOMERS)),
      http.get('*/api/vehicles/', () => HttpResponse.json(VEHICLES)),
      http.get('*/api/appointment-types/', () => HttpResponse.json([])),
    )
    renderForm()
    const picker = await screen.findByRole('combobox', { name: 'Type' })
    await waitFor(() => expect(picker).toBeDisabled())
    expect(picker).toHaveTextContent('No appointment types set up yet')
  })

  it('offers only the chosen customer’s vehicles', async () => {
    // Booking Nadia's car against Oliver's appointment is a data-integrity bug
    // the picker exists to prevent.
    serveLookups()
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('combobox', { name: 'Customer' })

    await choose(user, 'Customer', /Oliver Bennett/)
    await user.click(screen.getByRole('combobox', { name: /Vehicle/ }))
    expect(await screen.findByRole('option', { name: 'OB08AUD' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'NA11DIA' })).not.toBeInTheDocument()
  })

  it('offers every vehicle before a customer is chosen', async () => {
    serveLookups()
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('combobox', { name: /Vehicle/ })

    await user.click(screen.getByRole('combobox', { name: /Vehicle/ }))
    expect(await screen.findByRole('option', { name: 'OB08AUD' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'NA11DIA' })).toBeInTheDocument()
  })

  it('preselects the customer when booking from their detail page', async () => {
    serveLookups()
    renderForm('/g1/appointments/new?customer_id=c2')
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Customer' })).toHaveTextContent('Nadia Okafor'),
    )
  })

  it('offers no status picker when creating — a new appointment is always booked', async () => {
    serveLookups()
    renderForm()
    await screen.findByRole('combobox', { name: 'Type' })
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument()
  })

  it('sends the appointment with local times converted to offset ISO', async () => {
    serveLookups()
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/appointments/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeAppointment())
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('combobox', { name: 'Employee' })

    await choose(user, 'Employee', /greg@bennett.example/)
    await choose(user, 'Customer', /Oliver Bennett/)
    await user.type(screen.getByLabelText('Start'), '2026-09-14T09:00')
    await user.type(screen.getByLabelText('End'), '2026-09-14T10:00')
    await user.type(screen.getByLabelText('Notes'), 'Customer waiting.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Diary' })).toBeInTheDocument()
    expect(body).toMatchObject({
      employee_id: 'e1',
      customer_id: 'c1',
      vehicle_id: null,
      appointment_type_id: 'at1',
      status: 'BOOKED',
      notes: 'Customer waiting.',
    })
    expect(String(body.start_time)).toMatch(/^2026-09-14T09:00:00[+-]\d{2}:\d{2}$/)
  })

  it('confirms the booking with a toast', async () => {
    serveLookups()
    server.use(http.post('*/api/appointments/', () => HttpResponse.json(makeAppointment())))
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('combobox', { name: 'Employee' })
    await choose(user, 'Employee', /greg@/)
    await choose(user, 'Customer', /Oliver/)
    await user.type(screen.getByLabelText('Start'), '2026-09-14T09:00')
    await user.type(screen.getByLabelText('End'), '2026-09-14T10:00')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Appointment booked.')).toBeInTheDocument()
  })

  it('will not submit without a start and end time', async () => {
    serveLookups()
    let posted = false
    server.use(
      http.post('*/api/appointments/', () => {
        posted = true
        return HttpResponse.json(makeAppointment())
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('combobox', { name: 'Employee' })
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(posted).toBe(false)
    expect(screen.getByLabelText('Start')).toBeInvalid()
  })
})

describe('AppointmentForm — server rejections', () => {
  const submitMinimal = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByRole('combobox', { name: 'Employee' })
    await choose(user, 'Employee', /greg@/)
    await choose(user, 'Customer', /Oliver/)
    await user.type(screen.getByLabelText('Start'), '2026-09-14T09:00')
    await user.type(screen.getByLabelText('End'), '2026-09-14T10:00')
    await user.click(screen.getByRole('button', { name: 'Save' }))
  }

  it('treats a double-booking as a warning to resolve, not a hard error', async () => {
    serveLookups()
    server.use(
      http.post('*/api/appointments/', () =>
        HttpResponse.json(
          { code: 409, status: 'x', message: 'That mechanic is already booked then.' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await submitMinimal(user)

    const warning = await screen.findByText('That mechanic is already booked then.')
    expect(warning).toBeInTheDocument()
    // Still on the form so the time can be adjusted, with entries preserved.
    expect(screen.getByLabelText('Start')).toHaveValue('2026-09-14T09:00')
  })

  it('shows per-field messages from a validation failure', async () => {
    serveLookups()
    server.use(
      http.post('*/api/appointments/', () =>
        HttpResponse.json(
          { code: 422, status: 'x', errors: { json: { end_time: ['End must be after start.'] } } },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await submitMinimal(user)
    expect(await screen.findByText('End must be after start.')).toBeInTheDocument()
  })

  it('shows a form-level message for an unexpected server failure', async () => {
    serveLookups()
    server.use(
      http.post('*/api/appointments/', () =>
        HttpResponse.json({ code: 500, status: 'x', message: 'Server error.' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await submitMinimal(user)
    expect(await screen.findByText('Server error.')).toBeInTheDocument()
  })

  it('books only once when Save is clicked repeatedly', async () => {
    serveLookups()
    let posts = 0
    server.use(
      http.post('*/api/appointments/', async () => {
        posts++
        await delay(30)
        return HttpResponse.json(makeAppointment())
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await screen.findByRole('combobox', { name: 'Employee' })
    await choose(user, 'Employee', /greg@/)
    await choose(user, 'Customer', /Oliver/)
    await user.type(screen.getByLabelText('Start'), '2026-09-14T09:00')
    await user.type(screen.getByLabelText('End'), '2026-09-14T10:00')
    await user.tripleClick(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('heading', { name: 'Diary' })
    expect(posts).toBe(1)
  })
})

describe('AppointmentForm — editing', () => {
  const EXISTING = makeAppointment({
    id: 'a1',
    employee_id: 'e1',
    customer_id: 'c2',
    vehicle_id: 'v2',
    appointment_type_id: 'at2',
    status: 'BOOKED',
    notes: 'Bring the spare key.',
  })

  it('loads the appointment into every field', async () => {
    serveLookups([EXISTING])
    renderForm('/g1/appointments/a1/edit')

    expect(screen.getByRole('heading', { name: 'Edit appointment' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Customer' })).toHaveTextContent('Nadia Okafor'),
    )
    expect(screen.getByRole('combobox', { name: /Vehicle/ })).toHaveTextContent('NA11DIA')
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('Full service')
    expect(screen.getByLabelText('Notes')).toHaveValue('Bring the spare key.')
  })

  it('offers a status picker using the garage’s own labels', async () => {
    serveLookups([EXISTING])
    server.use(
      http.get('*/api/appointment-statuses/', () =>
        HttpResponse.json([
          makeGarageStatus({ key: 'BOOKED', label: 'On the ramp', sort_order: 1 }),
          makeGarageStatus({ id: 's2', key: 'COMPLETED', label: 'Handed back', sort_order: 2 }),
        ]),
      ),
    )
    const user = userEvent.setup()
    renderForm('/g1/appointments/a1/edit')
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('On the ramp'),
    )

    await user.click(screen.getByRole('combobox', { name: 'Status' }))
    expect(await screen.findByRole('option', { name: 'Handed back' })).toBeInTheDocument()
  })

  it('saves the change without announcing a new booking', async () => {
    serveLookups([EXISTING])
    let body: Record<string, unknown> = {}
    server.use(
      http.patch('*/api/appointments/:id', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(EXISTING)
      }),
    )
    const user = userEvent.setup()
    renderForm('/g1/appointments/a1/edit')
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveValue('Bring the spare key.'))

    await user.clear(screen.getByLabelText('Notes'))
    await user.type(screen.getByLabelText('Notes'), 'Key is with reception.')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Diary' })).toBeInTheDocument()
    expect(body.notes).toBe('Key is with reception.')
    expect(screen.queryByText('Appointment booked.')).not.toBeInTheDocument()
  })
})

describe('AppointmentForm — cancelling an appointment', () => {
  const BOOKED = makeAppointment({ id: 'a1', status: 'BOOKED' })

  it('offers cancellation only for an appointment that is still booked', async () => {
    serveLookups([makeAppointment({ id: 'a1', status: 'COMPLETED' })])
    renderForm('/g1/appointments/a1/edit')
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('MOT test'),
    )
    expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument()
  })

  it('asks for confirmation and does nothing when declined', async () => {
    serveLookups([BOOKED])
    let cancels = 0
    server.use(
      http.delete('*/api/appointments/:id', () => {
        cancels++
        return new HttpResponse(null, { status: 204 })
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderForm('/g1/appointments/a1/edit')

    await user.click(await screen.findByRole('button', { name: 'Cancel appointment' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(cancels).toBe(0)
  })

  it('cancels once confirmed and returns to the diary', async () => {
    serveLookups([BOOKED])
    server.use(http.delete('*/api/appointments/:id', () => new HttpResponse(null, { status: 204 })))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderForm('/g1/appointments/a1/edit')

    await user.click(await screen.findByRole('button', { name: 'Cancel appointment' }))
    expect(await screen.findByText('Appointment cancelled.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Diary' })).toBeInTheDocument()
  })

  it('reports a failed cancellation instead of appearing to succeed', async () => {
    serveLookups([BOOKED])
    server.use(
      http.delete('*/api/appointments/:id', () =>
        HttpResponse.json({ code: 403, status: 'x', message: 'Not permitted.' }, { status: 403 }),
      ),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderForm('/g1/appointments/a1/edit')

    await user.click(await screen.findByRole('button', { name: 'Cancel appointment' }))
    expect(await screen.findByText('Not permitted.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Edit appointment' })).toBeInTheDocument()
  })
})
