import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeQueueDashboard, makeQueueEntry } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { formatTime } from '../../lib/datetime'
import { QueueDashboard } from './QueueDashboard'

function renderDashboard() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/queue" element={<QueueDashboard />} />
    </Routes>,
    { route: '/g1/queue' },
  )
}

const WAITING = [
  makeQueueEntry({ id: 'w1', ticket_number: 4, customer_first_name: 'Ada', position: 1 }),
  makeQueueEntry({
    id: 'w2',
    ticket_number: 5,
    customer_first_name: 'Ben',
    customer_last_name: null,
    position: 2,
    estimated_start_at: '2099-09-14T10:30:00Z',
    estimated_wait_minutes: 30,
  }),
]

function useDashboard(patch: Parameters<typeof makeQueueDashboard>[0]) {
  server.use(http.get('*/api/queue', () => HttpResponse.json(makeQueueDashboard(patch))))
}

describe('QueueDashboard', () => {
  it('groups today by stage, with live estimates', async () => {
    useDashboard({
      entries: [
        ...WAITING,
        makeQueueEntry({
          id: 'c1',
          ticket_number: 3,
          customer_first_name: 'Cal',
          status: 'CALLED',
          position: null,
          called_at: '2099-09-14T09:58:00Z',
          call_expires_at: '2099-09-14T10:08:00Z',
        }),
        makeQueueEntry({ id: 's1', ticket_number: 2, status: 'IN_SERVICE', position: null }),
        makeQueueEntry({ id: 'd1', ticket_number: 1, status: 'DONE', position: null }),
      ],
    })
    renderDashboard()

    const waiting = await screen.findByRole('region', { name: 'Waiting' })
    const rows = within(waiting).getAllByRole('listitem')
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Ticket 4, Ada Walker',
      'Ticket 5, Ben',
    ])
    expect(within(rows[0]).getByText('Now')).toBeInTheDocument()
    expect(
      within(rows[1]).getByText(`about 30 min · ~${formatTime('2099-09-14T10:30:00Z')}`),
    ).toBeInTheDocument()

    const called = screen.getByRole('region', { name: 'Called forward' })
    expect(within(called).getByText(new RegExp(`skip at ${formatTime('2099-09-14T10:08:00Z')}`))).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Being served' })).toHaveTextContent('#2')
    expect(screen.getByText('Finished today (1)')).toBeInTheDocument()
    expect(screen.getByText(/A new walk-in would wait about 30 min/)).toBeInTheDocument()
  })

  it('calls the next person', async () => {
    useDashboard({ entries: WAITING })
    let called = false
    server.use(
      http.post('*/api/queue/call-next', () => {
        called = true
        return HttpResponse.json(makeQueueEntry({ status: 'CALLED' }))
      }),
    )
    const user = userEvent.setup()
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'Call next' }))
    await waitFor(() => expect(called).toBe(true))
  })

  it('disables "Call next" when nobody is waiting', async () => {
    renderDashboard()
    expect(await screen.findByRole('button', { name: 'Call next' })).toBeDisabled()
    expect(screen.getByText('Nobody is waiting.')).toBeInTheDocument()
  })

  it('checks a called customer in and completes a served one', async () => {
    useDashboard({
      entries: [
        makeQueueEntry({ id: 'c1', status: 'CALLED', position: null }),
        makeQueueEntry({ id: 's1', ticket_number: 2, status: 'IN_SERVICE', position: null }),
      ],
    })
    const actions: string[] = []
    server.use(
      http.post('*/api/queue/entries/:id/:action', ({ params }) => {
        actions.push(`${params.id}:${params.action}`)
        return HttpResponse.json(makeQueueEntry())
      }),
    )
    const user = userEvent.setup()
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: 'Arrived — start' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(actions).toEqual(['c1:start', 's1:complete']))
  })

  it('reorders the waiting list with the up/down controls', async () => {
    useDashboard({ entries: WAITING })
    let sent: unknown
    server.use(
      http.put('*/api/queue/order', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(makeQueueDashboard({ entries: [...WAITING].reverse() }))
      }),
    )
    const user = userEvent.setup()
    renderDashboard()
    expect(await screen.findByRole('button', { name: 'Move ticket 4 up' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move ticket 5 up' }))
    await waitFor(() => expect(sent).toEqual({ entry_ids: ['w2', 'w1'] }))
  })

  it('opens and closes the queue', async () => {
    useDashboard({ is_open: false, accepting_joins: false, refusal_message: "The walk-in queue isn't open right now." })
    let opened = false
    server.use(
      http.post('*/api/queue/open', () => {
        opened = true
        return HttpResponse.json(makeQueueDashboard({ is_open: true }))
      }),
    )
    const user = userEvent.setup()
    renderDashboard()
    expect(await screen.findByText("The walk-in queue isn't open right now.", { exact: false })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open queue' }))
    await waitFor(() => expect(opened).toBe(true))
    expect(await screen.findByRole('button', { name: 'Close queue' })).toBeInTheDocument()
  })

  it('shows bookings and walk-ins on one timeline', async () => {
    useDashboard({
      entries: WAITING,
      appointments: [
        {
          id: 'a1',
          start_time: '2099-09-14T10:15:00Z',
          end_time: '2099-09-14T11:15:00Z',
          status: 'BOOKED',
          customer_name: 'Booked Betty',
          appointment_type_name: 'MOT',
          employee_name: 'Ann',
          is_walk_in: false,
        },
      ],
    })
    renderDashboard()
    const timeline = await screen.findByRole('region', { name: "Today's timeline" })
    const items = within(timeline).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('#4 Ada')
    expect(items[1]).toHaveTextContent('Booked Betty')
    expect(items[2]).toHaveTextContent('#5 Ben')
    expect(items[1]).toHaveTextContent('Booked · MOT · Ann')
    expect(items[2]).toHaveTextContent(`~${formatTime('2099-09-14T10:30:00Z')}`)
  })

  it('surfaces a failed action as a toast', async () => {
    useDashboard({ entries: WAITING })
    server.use(
      http.post('*/api/queue/entries/:id/:action', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'Unprocessable Entity',
            message: 'Add at least one active service before checking walk-ins in.',
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderDashboard()
    const waiting = await screen.findByRole('region', { name: 'Waiting' })
    await user.click(within(waiting).getAllByRole('button', { name: 'Start' })[0])
    expect(await screen.findByText(/Add at least one active service/)).toBeInTheDocument()
  })
})
