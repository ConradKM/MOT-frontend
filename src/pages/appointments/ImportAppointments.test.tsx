import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import {
  makeAppointmentItem,
  makeAppointmentType,
  makeEmployee,
  makeGarage,
  makeGarageStatus,
  makeImportResult,
  makeRole,
} from '../../test/fixtures'
import { expectNoA11yViolations } from '../../test/a11y'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { AppointmentsCalendar } from './AppointmentsCalendar'

/** Appointments → "Import appointments". */

function renderCalendar() {
  signInAsStaff('e1')
  server.use(
    http.get('*/api/garage/schedule', () =>
      HttpResponse.json({ settings: {}, opening_hours: [], exceptions: [] }),
    ),
  )
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/appointments" element={<AppointmentsCalendar />} />
    </Routes>,
    { route: '/g1/appointments?view=week&date=2030-01-07' },
  )
}

const ROWS = [
  { service: 'MOT', start: '2030-01-07T10:00', customer: { first_name: 'Sam', last_name: 'Lee' } },
  { service: 'MOT', start: '2030-01-07T10:30', customer: { first_name: 'Al', last_name: 'Kim' } },
]
const RESULT = makeImportResult(
  [
    makeAppointmentItem(0),
    makeAppointmentItem(
      1,
      { start: '2030-01-07T10:30:00+00:00', flags: ['clash'] },
      { warnings: [{ path: 'appointments[1].start', message: 'Already booked then.' }] },
    ),
  ],
  { kind: 'appointments', context: { timezone: 'Europe/London' } },
)

describe('Import appointments', () => {
  it('fills the AI prompt with the business’s own services, timezone and statuses', async () => {
    const user = userEvent.setup()
    let prompt = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (text: string) => void (prompt = text) },
      configurable: true,
    })
    server.use(
      http.get('*/api/garage', () => HttpResponse.json(makeGarage({ timezone: 'Europe/London' }))),
      http.get('*/api/appointment-types/', () =>
        HttpResponse.json([makeAppointmentType({ name: 'MOT' })]),
      ),
      http.get('*/api/appointment-statuses/', () =>
        HttpResponse.json([makeGarageStatus({ key: 'BOOKED' }), makeGarageStatus({ key: 'NO_SHOW' })]),
      ),
    )
    renderCalendar()

    await user.click(await screen.findByRole('button', { name: 'Import appointments' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import appointments' })
    await user.click(within(dialog).getByText('JSON format and AI prompt'))
    expect(within(dialog).getByText(/data protection/i)).toBeInTheDocument()
    await waitFor(async () => {
      await user.click(within(dialog).getByRole('button', { name: 'Copy AI prompt' }))
      expect(prompt).toBe(
        'Extract bookings. Services: "MOT". Times in Europe/London. Statuses: "BOOKED", "NO_SHOW".',
      )
    })
  })

  it('needs "import anyway" for a clash, then imports and refreshes the calendar', async () => {
    const user = userEvent.setup()
    const calls: Record<string, unknown>[] = []
    let appointmentReads = 0
    server.use(
      http.get('*/api/appointments/', () => {
        appointmentReads += 1
        return HttpResponse.json([])
      }),
      http.post('*/api/appointments/bulk', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        calls.push(body)
        return HttpResponse.json({ ...RESULT, dry_run: body.dry_run, committed: !body.dry_run })
      }),
    )
    renderCalendar()

    await user.click(await screen.findByRole('button', { name: 'Import appointments' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import appointments' })
    fireEvent.change(within(dialog).getByLabelText('Paste JSON'), {
      target: { value: JSON.stringify({ appointments: ROWS }) },
    })
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }))

    const importButton = await within(dialog).findByRole('button', { name: 'Import 2 appointments' })
    expect(importButton).toBeDisabled()
    expect(within(dialog).getByText('Double-booked')).toBeInTheDocument()
    await expectNoA11yViolations(dialog)

    await user.click(within(dialog).getByRole('checkbox', { name: /import anyway/i }))
    const readsBeforeCommit = appointmentReads
    await user.click(importButton)

    expect(await screen.findByText(/imported 2 appointments/i)).toBeInTheDocument()
    expect(calls[1]).toEqual({
      payload: { appointments: ROWS },
      dry_run: false,
      acknowledge_warnings: true,
    })
    await waitFor(() => expect(appointmentReads).toBeGreaterThan(readsBeforeCommit))
  })

  it('is not offered to staff who are not owners', async () => {
    server.use(
      http.get('*/api/employees/', () =>
        HttpResponse.json([makeEmployee({ roles: [makeRole({ name: 'STAFF' })] })]),
      ),
    )
    renderCalendar()

    expect(await screen.findByRole('button', { name: 'Add to calendar' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Import appointments' })).not.toBeInTheDocument(),
    )
  })
})
