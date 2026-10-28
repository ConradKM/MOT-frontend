import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import {
  makeAppointmentType,
  makeEmployee,
  makeImportItem,
  makeImportResult,
  makeRole,
} from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { AppointmentTypesList } from './AppointmentTypesList'

/** Settings → Appointment Types → "Bulk add (JSON)". */

function renderPage() {
  signInAsStaff()
  // Each row looks up its checklist; none exist here.
  server.use(
    http.get('*/api/appointment-types/:id/checklist-template', () =>
      HttpResponse.json({ code: 404, status: 'Not Found' }, { status: 404 }),
    ),
  )
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/appointment-types" element={<AppointmentTypesList />} />
    </Routes>,
    { route: '/g1/appointment-types' },
  )
}

const PAYLOAD = { services: [{ name: 'MOT' }, { name: 'Tyres', base_price: '40' }] }
const RESULT = makeImportResult([
  makeImportItem({ index: 0, status: 'EXISTS', normalised: { name: 'MOT' } }),
  makeImportItem({
    index: 1,
    normalised: {
      name: 'Tyres',
      base_price: '40',
      add_ons: [
        {
          name: 'Locking nut removal',
          description: null,
          price_delta: '-5.5',
          duration_delta_minutes: 15,
          max_quantity: 4,
          exclusivity_group: null,
          status: 'ACTIVE',
        },
      ],
    },
  }),
])

describe('Bulk add services', () => {
  it('previews, imports the same payload, and refreshes the list', async () => {
    const user = userEvent.setup()
    const calls: Record<string, unknown>[] = []
    let typeReads = 0
    let prompt = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async (text: string) => void (prompt = text) },
      configurable: true,
    })
    server.use(
      http.get('*/api/appointment-types/', () => {
        typeReads += 1
        return HttpResponse.json([makeAppointmentType({ id: 'at1', name: 'MOT' })])
      }),
      http.post('*/api/appointment-types/bulk', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        calls.push(body)
        return HttpResponse.json({ ...RESULT, dry_run: body.dry_run, committed: !body.dry_run })
      }),
    )
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Bulk add (JSON)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bulk add services (JSON)' })

    await user.click(within(dialog).getByText('JSON format and AI prompt'))
    await user.click(within(dialog).getByRole('button', { name: 'Copy AI prompt' }))
    expect(prompt).toContain('"MOT"')

    fireEvent.change(within(dialog).getByLabelText('Paste JSON'), {
      target: { value: JSON.stringify(PAYLOAD) },
    })
    await user.click(within(dialog).getByRole('button', { name: 'Preview' }))
    expect(await within(dialog).findByRole('cell', { name: 'Tyres' })).toBeInTheDocument()
    expect(within(dialog).getByText('Locking nut removal')).toBeInTheDocument()
    expect(within(dialog).getByText('−£5.50 · +15 min · up to 4')).toBeInTheDocument()
    const readsBeforeCommit = typeReads

    await user.click(within(dialog).getByRole('button', { name: 'Add 1 service' }))

    expect(await screen.findByText(/added 1 service; 1 already existed/i)).toBeInTheDocument()
    expect(calls).toEqual([
      { payload: PAYLOAD, dry_run: true, acknowledge_warnings: false },
      { payload: PAYLOAD, dry_run: false, acknowledge_warnings: false },
    ])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(typeReads).toBeGreaterThan(readsBeforeCommit))
  })

  it('is not offered to staff who are not owners', async () => {
    server.use(
      http.get('*/api/employees/', () =>
        HttpResponse.json([makeEmployee({ roles: [makeRole({ name: 'STAFF' })] })]),
      ),
    )
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Appointment Types' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Bulk add (JSON)' })).not.toBeInTheDocument()
  })
})
