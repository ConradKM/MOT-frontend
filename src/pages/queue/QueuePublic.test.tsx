import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { server } from '../../test/msw/server'
import {
  GARAGE_ID,
  QUEUE_TOKEN,
  makePublicAppointmentType,
  makePublicGarage,
  makePublicQueueInfo,
  makeQueueStatus,
} from '../../test/fixtures'
import { renderWithAppProviders } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { formatTime } from '../../lib/datetime'
import { readStoredQueueToken, storeQueueToken } from '../../lib/queue'
import { QueueJoin } from './QueueJoin'
import { QueueStatus } from './QueueStatus'

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.hash}`}</p>
}

function renderQueue(route: string) {
  return renderWithAppProviders(
    <>
      <Routes>
        <Route path="/queue/:garageId" element={<QueueJoin />} />
        <Route path="/queue/:garageId/status" element={<QueueStatus />} />
        <Route path="/book/:garageId" element={<h1>Booking wizard</h1>} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  )
}

const fillForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('First name'), 'Sam')
  await user.type(screen.getByLabelText('Mobile number'), '07123 456789')
}

describe('QueueJoin', () => {
  it('shows the live queue length and estimated wait', async () => {
    renderQueue(`/queue/${GARAGE_ID}`)
    const summary = await screen.findByLabelText('Current queue')
    expect(within(summary).getByText('2')).toBeInTheDocument()
    expect(within(summary).getByText('about 40 min')).toBeInTheDocument()
    expect(
      within(summary).getByText(`around ${formatTime('2099-09-14T10:40:00Z')}`),
    ).toBeInTheDocument()
  })

  it('joins and lands on the status page with the token only in the fragment', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post('*/api/public/:slug/queue/join', async ({ request, params }) => {
        expect(params.slug).toBe('bennett-motors')
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...makeQueueStatus(), token: QUEUE_TOKEN }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderQueue(`/queue/${GARAGE_ID}`)
    await screen.findByLabelText('Current queue')
    await fillForm(user)
    await user.type(screen.getByLabelText(/Vehicle registration/), 'wk12 abc')
    await user.click(screen.getByLabelText(/Text me when it's my turn/))
    await user.click(screen.getByRole('button', { name: 'Join the queue' }))

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        `/queue/${GARAGE_ID}/status#${QUEUE_TOKEN}`,
      ),
    )
    expect(body).toMatchObject({
      customer_first_name: 'Sam',
      customer_last_name: null,
      customer_phone: '07123 456789',
      sms_opt_in: true,
      vehicle_registration: 'WK12 ABC',
      appointment_type_id: null,
    })
    expect(readStoredQueueToken(GARAGE_ID)).toBe(QUEUE_TOKEN)
    expect(await screen.findByText('Your position')).toBeInTheDocument()
  })

  it('offers an optional service choice from the business menu', async () => {
    server.use(
      http.get('*/api/public/garages/:id', () =>
        HttpResponse.json(
          makePublicGarage({ appointment_types: [makePublicAppointmentType({ id: 'at9', name: 'Tyres' })] }),
        ),
      ),
    )
    let body: Record<string, unknown> | undefined
    server.use(
      http.post('*/api/public/:slug/queue/join', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...makeQueueStatus(), token: QUEUE_TOKEN }, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderQueue(`/queue/${GARAGE_ID}`)
    await screen.findByLabelText('Current queue')
    await fillForm(user)
    await user.selectOptions(screen.getByLabelText(/What do you need/), 'Tyres')
    await user.click(screen.getByRole('button', { name: 'Join the queue' }))
    await waitFor(() => expect(body?.appointment_type_id).toBe('at9'))
  })

  it('validates locally before sending anything', async () => {
    let posted = false
    server.use(
      http.post('*/api/public/:slug/queue/join', () => {
        posted = true
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderQueue(`/queue/${GARAGE_ID}`)
    await screen.findByLabelText('Current queue')
    await user.type(screen.getByLabelText('Mobile number'), '020 7946 0000')
    await user.click(screen.getByRole('button', { name: 'Join the queue' }))

    expect(screen.getByText('First name is required.')).toBeInTheDocument()
    expect(screen.getByText(/Enter a valid UK mobile number/)).toBeInTheDocument()
    expect(posted).toBe(false)
  })

  it('explains why the queue is not taking walk-ins, and offers booking instead', async () => {
    server.use(
      http.get('*/api/public/:slug/queue', () =>
        HttpResponse.json(
          makePublicQueueInfo({
            accepting_joins: false,
            refusal_reason: 'full_for_today',
            refusal_message: 'The queue is full for today.',
            estimated_wait_minutes: null,
          }),
        ),
      ),
    )
    renderQueue(`/queue/${GARAGE_ID}`)
    expect(await screen.findByText('The queue is full for today.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join the queue' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Book an appointment instead' })).toHaveAttribute(
      'href',
      `/book/${GARAGE_ID}`,
    )
  })

  it('shows a server refusal (e.g. already queued) as a form error', async () => {
    server.use(
      http.post('*/api/public/:slug/queue/join', () =>
        HttpResponse.json(
          {
            code: 409,
            status: 'Conflict',
            message: "This mobile number is already in today's queue.",
            errors: { reason: 'already_in_queue' },
          },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderQueue(`/queue/${GARAGE_ID}`)
    await screen.findByLabelText('Current queue')
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Join the queue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already in today')
  })

  it('maps a server-side field error onto the field', async () => {
    server.use(
      http.post('*/api/public/:slug/queue/join', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'Unprocessable Entity',
            errors: { json: { customer_phone: ['That looks like a landline number.'] } },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderQueue(`/queue/${GARAGE_ID}`)
    await screen.findByLabelText('Current queue')
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Join the queue' }))
    expect(await screen.findByText('That looks like a landline number.')).toBeInTheDocument()
  })

  it('links back to an existing place in the queue', async () => {
    storeQueueToken(GARAGE_ID, QUEUE_TOKEN)
    renderQueue(`/queue/${GARAGE_ID}`)
    expect(await screen.findByRole('link', { name: 'See your place' })).toHaveAttribute(
      'href',
      `/queue/${GARAGE_ID}/status#${QUEUE_TOKEN}`,
    )
  })

  it('handles an unknown business', async () => {
    server.use(
      http.get('*/api/public/garages/:id', () =>
        HttpResponse.json({ code: 404, status: 'Not Found' }, { status: 404 }),
      ),
    )
    renderQueue('/queue/nope')
    expect(await screen.findByText('Business not found')).toBeInTheDocument()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = renderQueue(`/queue/${GARAGE_ID}`)
    await screen.findByLabelText('Current queue')
    await expectNoA11yViolations(container)
  })
})

describe('QueueStatus', () => {
  it('posts the fragment token (never in the URL) and shows position + ETA', async () => {
    let posted: unknown
    server.use(
      http.post('*/api/public/:slug/queue/status', async ({ request }) => {
        expect(new URL(request.url).search).toBe('')
        posted = await request.json()
        return HttpResponse.json(makeQueueStatus())
      }),
    )
    renderQueue(`/queue/${GARAGE_ID}/status#${QUEUE_TOKEN}`)
    expect(await screen.findByText('Your position')).toBeInTheDocument()
    expect(posted).toEqual({ token: QUEUE_TOKEN })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2 people ahead')).toBeInTheDocument()
    expect(screen.getByText('about 40 min')).toBeInTheDocument()
    // Remembered, so the plain queue link finds this place again.
    expect(readStoredQueueToken(GARAGE_ID)).toBe(QUEUE_TOKEN)
  })

  it('falls back to the remembered token when opened without a fragment', async () => {
    storeQueueToken(GARAGE_ID, QUEUE_TOKEN)
    renderQueue(`/queue/${GARAGE_ID}/status`)
    expect(await screen.findByText('Your position')).toBeInTheDocument()
  })

  it("tells the customer when it's their turn", async () => {
    server.use(
      http.post('*/api/public/:slug/queue/status', () =>
        HttpResponse.json(
          makeQueueStatus({
            status: 'CALLED',
            position: null,
            people_ahead: null,
            called_at: '2099-09-14T10:00:00Z',
            call_expires_at: '2099-09-14T10:10:00Z',
          }),
        ),
      ),
    )
    renderQueue(`/queue/${GARAGE_ID}/status#${QUEUE_TOKEN}`)
    expect(await screen.findByText("It's your turn!")).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`by ${formatTime('2099-09-14T10:10:00Z')}`)),
    ).toBeInTheDocument()
  })

  it('warns when the estimate runs past closing', async () => {
    server.use(
      http.post('*/api/public/:slug/queue/status', () =>
        HttpResponse.json(
          makeQueueStatus({ fits_today: false, estimated_start_at: null, estimated_wait_minutes: null }),
        ),
      ),
    )
    renderQueue(`/queue/${GARAGE_ID}/status#${QUEUE_TOKEN}`)
    expect(await screen.findByText(/may not reach you before closing/)).toBeInTheDocument()
  })

  it('lets the customer leave the queue after confirming', async () => {
    let cancelled = false
    server.use(
      http.post('*/api/public/:slug/queue/cancel', async ({ request }) => {
        cancelled = true
        expect(await request.json()).toEqual({ token: QUEUE_TOKEN })
        return HttpResponse.json(
          makeQueueStatus({ status: 'CANCELLED', end_reason: 'CUSTOMER_CANCELLED', position: null }),
        )
      }),
    )
    const user = userEvent.setup()
    renderQueue(`/queue/${GARAGE_ID}/status#${QUEUE_TOKEN}`)
    await user.click(await screen.findByRole('button', { name: 'Leave the queue' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Leave the queue' }))

    expect(await screen.findByText("You've left the queue.")).toBeInTheDocument()
    expect(cancelled).toBe(true)
    expect(readStoredQueueToken(GARAGE_ID)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Leave the queue' })).not.toBeInTheDocument()
  })

  it('handles an unknown or expired link', async () => {
    server.use(
      http.post('*/api/public/:slug/queue/status', () =>
        HttpResponse.json({ code: 404, status: 'Not Found' }, { status: 404 }),
      ),
    )
    storeQueueToken(GARAGE_ID, 'stale')
    renderQueue(`/queue/${GARAGE_ID}/status#${QUEUE_TOKEN}`)
    expect(await screen.findByText("We couldn't find your place")).toBeInTheDocument()
    await waitFor(() => expect(readStoredQueueToken(GARAGE_ID)).toBeNull())
  })

  it('asks for the link when there is no token at all', async () => {
    renderQueue(`/queue/${GARAGE_ID}/status`)
    expect(await screen.findByText("We couldn't find your place")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Join the queue' })).toHaveAttribute(
      'href',
      `/queue/${GARAGE_ID}`,
    )
  })
})
