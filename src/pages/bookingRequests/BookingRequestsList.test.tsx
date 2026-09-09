import { describe, expect, it } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeAppointmentType, makeEmployee } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { BookingRequestsList } from './BookingRequestsList'
import type { BookingRequest } from '../../api/bookingRequests'

function makeRequest(patch: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'br1',
    garage_id: 'g1',
    status: 'PENDING',
    customer_first_name: 'Oliver',
    customer_last_name: 'Bennett',
    customer_full_name: 'Oliver Bennett',
    customer_email: 'oliver@example.com',
    customer_phone: '+447123456789',
    vehicle_registration: 'OB08AUD',
    vehicle_make: 'Audi',
    vehicle_model: 'A4',
    vehicle_year: 2018,
    vehicle_mileage: 40000,
    appointment_type_id: 'at1',
    appointment_type: { id: 'at1', name: 'MOT test', base_price: '54.85' },
    duration_minutes: 60,
    requested_price: null,
    preferred_date: '2026-09-14',
    preferred_time: '09:00:00',
    preferred_employee_note: null,
    notes: null,
    staff_notes: null,
    reviewed_by_name: null,
    reviewed_at: null,
    slot_check: { checked: true, available: true },
    created_at: '2026-09-01T09:00:00+01:00',
    updated_at: '2026-09-01T09:00:00+01:00',
    ...patch,
  } as BookingRequest
}

function serveRequests(byStatus: Record<string, BookingRequest[]>) {
  server.use(
    http.get('*/api/booking-requests/', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status') ?? 'PENDING'
      return HttpResponse.json(byStatus[status] ?? [])
    }),
    http.get('*/api/employees/', () => HttpResponse.json([makeEmployee({ id: 'e1' })])),
    http.get('*/api/appointment-types/', () => HttpResponse.json([makeAppointmentType({ id: 'at1' })])),
  )
}

function renderList() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/booking-requests" element={<BookingRequestsList />} />
    </Routes>,
    { route: '/g1/booking-requests' },
  )
}

describe('BookingRequestsList — the queue', () => {
  it('shows a loading message before the requests arrive', async () => {
    server.use(
      http.get('*/api/booking-requests/', async () => {
        await delay(50)
        return HttpResponse.json([makeRequest()])
      }),
    )
    renderList()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Oliver Bennett')).toBeInTheDocument()
  })

  it('lists a pending request with its vehicle, service and preferred slot', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    renderList()

    const row = (await screen.findByText('Oliver Bennett')).closest('tr')!
    expect(within(row).getByText('OB08AUD')).toBeInTheDocument()
    expect(within(row).getByText('MOT test')).toBeInTheDocument()
    expect(within(row).getByText('14 Sep 2026, 09:00')).toBeInTheDocument()
    expect(within(row).getByText('1h · £54.85')).toBeInTheDocument()
  })

  it('says the queue is empty rather than showing a bare table', async () => {
    serveRequests({ PENDING: [] })
    renderList()
    expect(await screen.findByText('No pending booking requests.')).toBeInTheDocument()
  })

  it('switches tabs and re-queries for that status, with its own empty message', async () => {
    serveRequests({
      PENDING: [makeRequest()],
      REJECTED: [],
      APPROVED: [makeRequest({ id: 'br2', customer_full_name: 'Nadia Okafor', status: 'APPROVED', reviewed_at: '2026-09-02T10:00:00+01:00', reviewed_by_name: 'Greg Mason' })],
    })
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Oliver Bennett')

    await user.click(screen.getByRole('button', { name: 'Approved' }))
    expect(await screen.findByText('Nadia Okafor')).toBeInTheDocument()
    expect(screen.queryByText('Oliver Bennett')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rejected' }))
    expect(await screen.findByText('No rejected booking requests.')).toBeInTheDocument()
  })

  it('offers no approve/reject actions on an already-reviewed request', async () => {
    serveRequests({
      PENDING: [],
      APPROVED: [makeRequest({ status: 'APPROVED', reviewed_at: '2026-09-02T10:00:00+01:00' })],
    })
    const user = userEvent.setup()
    renderList()
    await user.click(screen.getByRole('button', { name: 'Approved' }))
    await screen.findByText('Oliver Bennett')

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
  })
})

describe('BookingRequestsList — reviewing a request', () => {
  it('expands the full details on View, and collapses again', async () => {
    serveRequests({ PENDING: [makeRequest({ notes: 'Please check the brakes.' })] })
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Oliver Bennett')

    await user.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByText('Please check the brakes.')).toBeInTheDocument()
    expect(screen.getByText('Still available')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.queryByText('Please check the brakes.')).not.toBeInTheDocument()
  })

  it('renders a request with no vehicle details or service without breaking', async () => {
    serveRequests({
      PENDING: [
        makeRequest({
          vehicle_make: null,
          vehicle_model: null,
          vehicle_year: null,
          vehicle_mileage: null,
          appointment_type: null,
          appointment_type_id: null,
          duration_minutes: null,
        }),
      ],
    })
    const user = userEvent.setup()
    renderList()
    await user.click(await screen.findByRole('button', { name: 'View' }))

    expect(screen.getByText('OB08AUD — details not given')).toBeInTheDocument()
    expect(screen.getByText('Not given')).toBeInTheDocument()
    expect(screen.getAllByText(/Not specified/).length).toBeGreaterThan(0)
  })
})

describe('BookingRequestsList — approving', () => {
  const openApprove = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByText('Oliver Bennett')
    await user.click(screen.getByRole('button', { name: 'Approve' }))
  }

  it('preselects the first eligible employee when the approve panel opens', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    server.use(
      http.get('*/api/employees/', () =>
        HttpResponse.json([
          makeEmployee({ id: 'e1', first_name: 'Ada' }),
          makeEmployee({ id: 'e2', first_name: 'Bea' }),
        ]),
      ),
    )
    const user = userEvent.setup()
    renderList()
    await openApprove(user)

    // Assignee defaulted, so approval only needs the (already-set) type.
    expect(screen.getByLabelText('Assign to')).toHaveValue('e1')
    expect(screen.getByRole('button', { name: 'Approve & create appointment' })).toBeEnabled()
  })

  it('lets staff change the preselected employee, and blocks approval if cleared', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    server.use(
      http.get('*/api/employees/', () =>
        HttpResponse.json([
          makeEmployee({ id: 'e1', first_name: 'Ada' }),
          makeEmployee({ id: 'e2', first_name: 'Bea' }),
        ]),
      ),
    )
    const user = userEvent.setup()
    renderList()
    await openApprove(user)

    await user.selectOptions(screen.getByLabelText('Assign to'), 'e2')
    expect(screen.getByLabelText('Assign to')).toHaveValue('e2')

    await user.selectOptions(screen.getByLabelText('Assign to'), '')
    expect(screen.getByRole('button', { name: 'Approve & create appointment' })).toBeDisabled()
  })

  it('leaves the assignee blank when there are no eligible employees', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    server.use(http.get('*/api/employees/', () => HttpResponse.json([])))
    const user = userEvent.setup()
    renderList()
    await openApprove(user)

    expect(screen.getByLabelText('Assign to')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Approve & create appointment' })).toBeDisabled()
  })

  it('carries the customer’s chosen service through as the default type', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    const user = userEvent.setup()
    renderList()
    await openApprove(user)
    expect(screen.getByLabelText('Type')).toHaveValue('at1')
  })

  it('blocks approval until a type is chosen when the customer named none', async () => {
    serveRequests({ PENDING: [makeRequest({ appointment_type_id: null, appointment_type: null })] })
    const user = userEvent.setup()
    renderList()
    await openApprove(user)

    const submit = screen.getByRole('button', { name: 'Approve & create appointment' })
    await user.selectOptions(screen.getByLabelText('Assign to'), 'e1')
    expect(submit).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Type'), 'at1')
    expect(submit).toBeEnabled()
  })

  it('defaults the start time to the customer’s preferred slot', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    const user = userEvent.setup()
    renderList()
    await openApprove(user)
    expect(screen.getByLabelText('Start')).toHaveValue('2026-09-14T09:00')
  })

  it('falls back to 09:00 when the customer named no time', async () => {
    serveRequests({ PENDING: [makeRequest({ preferred_time: null })] })
    const user = userEvent.setup()
    renderList()
    await openApprove(user)
    expect(screen.getByLabelText('Start')).toHaveValue('2026-09-14T09:00')
  })

  it('sends the assignment and confirms the appointment was created', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/booking-requests/:id/approve', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 'a1' })
      }),
    )
    const user = userEvent.setup()
    renderList()
    await openApprove(user)
    await user.selectOptions(screen.getByLabelText('Assign to'), 'e1')
    await user.selectOptions(screen.getByLabelText('Type'), 'at1')
    await user.click(screen.getByRole('button', { name: 'Approve & create appointment' }))

    expect(await screen.findByText('Booking approved — appointment created.')).toBeInTheDocument()
    expect(body).toMatchObject({ employee_id: 'e1', appointment_type_id: 'at1' })
    expect(String(body.start_time)).toMatch(/^2026-09-14T09:00:00[+-]\d{2}:\d{2}$/)
  })

  it('warns when the slot has been taken since the request came in', async () => {
    serveRequests({ PENDING: [makeRequest({ slot_check: { checked: true, available: false } })] })
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Oliver Bennett')

    expect(screen.getByText('Slot may be full')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    // Once expanded: the availability row plus the actionable warning above the form.
    expect(screen.getAllByText(/This time slot is no longer available/)).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'approve anyway' })).toBeInTheDocument()
  })

  it('lets staff override the conflict warning deliberately', async () => {
    serveRequests({ PENDING: [makeRequest({ slot_check: { checked: true, available: false } })] })
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Oliver Bennett')
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    await user.click(screen.getByRole('button', { name: 'approve anyway' }))
    expect(screen.queryByText(/You can still approve it against a different time/)).not.toBeInTheDocument()
  })

  it('surfaces a rejection from the server without closing the form', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    server.use(
      http.post('*/api/booking-requests/:id/approve', () =>
        HttpResponse.json(
          { code: 409, status: 'x', message: 'That mechanic is already booked then.' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderList()
    await openApprove(user)
    await user.selectOptions(screen.getByLabelText('Assign to'), 'e1')
    await user.selectOptions(screen.getByLabelText('Type'), 'at1')
    await user.click(screen.getByRole('button', { name: 'Approve & create appointment' }))

    expect(await screen.findByText('That mechanic is already booked then.')).toBeInTheDocument()
    expect(screen.getByLabelText('Assign to')).toHaveValue('e1')
  })

  it('approves once however many times the button is clicked', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    let posts = 0
    server.use(
      http.post('*/api/booking-requests/:id/approve', async () => {
        posts++
        await delay(30)
        return HttpResponse.json({ id: 'a1' })
      }),
    )
    const user = userEvent.setup()
    renderList()
    await openApprove(user)
    await user.selectOptions(screen.getByLabelText('Assign to'), 'e1')
    await user.selectOptions(screen.getByLabelText('Type'), 'at1')
    await user.tripleClick(screen.getByRole('button', { name: 'Approve & create appointment' }))

    await screen.findByText('Booking approved — appointment created.')
    expect(posts).toBe(1)
  })

  it('abandons the approval on Cancel without sending anything', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    let posts = 0
    server.use(
      http.post('*/api/booking-requests/:id/approve', () => {
        posts++
        return HttpResponse.json({ id: 'a1' })
      }),
    )
    const user = userEvent.setup()
    renderList()
    await openApprove(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Assign to')).not.toBeInTheDocument()
    expect(posts).toBe(0)
  })
})

describe('BookingRequestsList — rejecting', () => {
  it('sends an optional reason and confirms the rejection', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/booking-requests/:id/reject', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 'br1' })
      }),
    )
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Oliver Bennett')
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.type(screen.getByLabelText('Reason (optional)'), 'No capacity that week.')
    await user.click(screen.getByRole('button', { name: 'Reject request' }))

    expect(await screen.findByText('Booking request rejected.')).toBeInTheDocument()
    expect(body).toEqual({ staff_notes: 'No capacity that week.' })
  })

  it('sends null rather than an empty reason when none is given', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/booking-requests/:id/reject', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 'br1' })
      }),
    )
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Oliver Bennett')
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.click(screen.getByRole('button', { name: 'Reject request' }))

    await waitFor(() => expect(body).toEqual({ staff_notes: null }))
  })

  it('surfaces a failed rejection', async () => {
    serveRequests({ PENDING: [makeRequest()] })
    server.use(
      http.post('*/api/booking-requests/:id/reject', () =>
        HttpResponse.json({ code: 403, status: 'x', message: 'Only owners can reject.' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Oliver Bennett')
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.click(screen.getByRole('button', { name: 'Reject request' }))

    expect(await screen.findByText('Only owners can reject.')).toBeInTheDocument()
  })
})
