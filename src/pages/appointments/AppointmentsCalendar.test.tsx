import { Route, Routes } from 'react-router-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { AppointmentsCalendar } from './AppointmentsCalendar'
import { renderWithAppProviders } from '../../test/utils'
import { server } from '../../test/msw/server'
import { makeAppointment } from '../../test/fixtures'
import { formatLongDate, todayIso } from '../../lib/datetime'

function renderCalendar() {
  server.use(http.get('*/api/garage/schedule', () => HttpResponse.json({ settings: {}, opening_hours: [], exceptions: [] })))
  return renderWithAppProviders(<Routes><Route path="/:garageId/appointments" element={<AppointmentsCalendar />} /></Routes>, { route: '/g1/appointments?view=month&date=2026-09-15' })
}

describe('AppointmentsCalendar month navigation', () => {
  it('uses the complete visible grid range and moves by calendar month', async () => {
    const requestedRanges: string[] = []
    server.use(http.get('*/api/appointments/', ({ request }) => { requestedRanges.push(new URL(request.url).search); return HttpResponse.json([]) }))
    renderCalendar()
    await screen.findByRole('button', { name: 'View Tuesday, 15 September 2026' })
    expect(requestedRanges).toContain('?start_date=2026-08-31&end_date=2026-10-04')
    fireEvent.click(screen.getByRole('button', { name: '← Prev' }))
    await waitFor(() => expect(requestedRanges).toContain('?start_date=2026-07-27&end_date=2026-09-06'))
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    await waitFor(() => expect(requestedRanges.filter((range) => range === '?start_date=2026-08-31&end_date=2026-10-04')).toHaveLength(2))
  })

  it('Today returns to the current month and choosing a day switches to Day view', async () => {
    const dates: string[] = []
    server.use(http.get('*/api/appointments/', ({ request }) => { const url = new URL(request.url); if (url.searchParams.has('date')) dates.push(url.searchParams.get('date')!); return HttpResponse.json([makeAppointment()]) }))
    renderCalendar()
    await screen.findByRole('button', { name: 'Today' })
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    const today = todayIso()
    await screen.findByRole('button', { name: `View ${formatLongDate(today)}` })
    fireEvent.click(screen.getByRole('button', { name: `View ${formatLongDate(today)}` }))
    await waitFor(() => expect(dates).toContain(today))
  })
})
