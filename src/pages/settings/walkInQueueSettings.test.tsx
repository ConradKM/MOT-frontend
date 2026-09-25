import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeQueueSettings, makeReservedWindow } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { BOOKING_BASE_URL } from '../../lib/bookingUrl'
import { WalkInQueueSettings } from './WalkInQueueSettings'

function renderSettings() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/walk-in-queue" element={<WalkInQueueSettings />} />
    </Routes>,
    { route: '/g1/settings/walk-in-queue' },
  )
}

describe('WalkInQueueSettings', () => {
  it('explains the automatic estimate and the shared capacity', async () => {
    renderSettings()
    expect(
      await screen.findByText(/Currently 35 min — the typical length of your last 9/),
    ).toBeInTheDocument()
    const explainer = screen.getByText(/across the 2 customers you can serve at once/)
    expect(within(explainer).getByRole('link', { name: 'Availability' })).toHaveAttribute(
      'href',
      '/g1/settings/availability',
    )
  })

  it('says when there is not enough history yet', async () => {
    server.use(
      http.get('*/api/queue/settings', () =>
        HttpResponse.json(
          makeQueueSettings({
            average: { effective_minutes: 60, source: 'DEFAULT', auto_minutes: null, auto_sample_size: 2 },
          }),
        ),
      ),
    )
    renderSettings()
    expect(await screen.findByText(/Not enough history yet \(2 of 5/)).toBeInTheDocument()
  })

  it('saves a manual average and the no-show timeout', async () => {
    let sent: unknown
    server.use(
      http.put('*/api/queue/settings', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(makeQueueSettings({ average_mode: 'MANUAL', manual_average_minutes: 25 }))
      }),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByLabelText('Set it myself'))
    await user.type(screen.getByLabelText('Minutes per walk-in'), '25')
    const timeout = screen.getByLabelText(/Skip a called customer after/)
    await user.clear(timeout)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(sent).toEqual({
        average_mode: 'MANUAL',
        manual_average_minutes: 25,
        no_show_timeout_minutes: null,
        default_appointment_type_id: null,
      }),
    )
    expect(await screen.findByText('Walk-in queue settings saved.')).toBeInTheDocument()
  })

  it('refuses manual mode without a figure', async () => {
    let sent = false
    server.use(
      http.put('*/api/queue/settings', () => {
        sent = true
        return HttpResponse.json(makeQueueSettings())
      }),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByLabelText('Set it myself'))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText(/Enter how long a typical walk-in takes/)).toBeInTheDocument()
    expect(sent).toBe(false)
  })

  it('shows the owner-only message on a 403', async () => {
    server.use(
      http.put('*/api/queue/settings', () =>
        HttpResponse.json({ code: 403, status: 'Forbidden', message: 'Owner role required.' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Only the business owner can change walk-in queue settings.'),
    ).toBeInTheDocument()
  })

  it('lists and reserves walk-in time', async () => {
    server.use(
      http.get('*/api/queue/reserved-windows', () =>
        HttpResponse.json([
          makeReservedWindow(),
          makeReservedWindow({ id: 'rw2', weekday: null, date: '2099-12-24', reserved_capacity: 2, note: 'Xmas' }),
        ]),
      ),
    )
    let sent: unknown
    server.use(
      http.post('*/api/queue/reserved-windows', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(makeReservedWindow(), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderSettings()
    expect(await screen.findByText('Every Monday, 09:00–11:00 · 1 place')).toBeInTheDocument()
    expect(screen.getByText(/11:00 · 2 places — Xmas/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Day'), 'Friday')
    await user.clear(screen.getByLabelText('Places kept free'))
    await user.type(screen.getByLabelText('Places kept free'), '2')
    await user.click(screen.getByRole('button', { name: 'Reserve time' }))
    await waitFor(() =>
      expect(sent).toEqual({
        weekday: 4,
        date: null,
        starts_at: '09:00',
        ends_at: '11:00',
        reserved_capacity: 2,
        note: null,
      }),
    )
  })

  it('validates a window before sending it', async () => {
    const user = userEvent.setup()
    renderSettings()
    await user.selectOptions(await screen.findByLabelText('Repeats'), 'One day only')
    await user.click(screen.getByRole('button', { name: 'Reserve time' }))
    expect(screen.getByText('Pick a date.')).toBeInTheDocument()
  })

  it('offers the queue QR code, pointed at the queue link', async () => {
    renderSettings()
    expect(await screen.findByText('Walk-in queue link')).toBeInTheDocument()
    expect(screen.getByText(`${BOOKING_BASE_URL}/queue/g1`)).toBeInTheDocument()
    expect(await screen.findByLabelText('Walk-in queue QR code')).toBeInTheDocument()
  })
})
