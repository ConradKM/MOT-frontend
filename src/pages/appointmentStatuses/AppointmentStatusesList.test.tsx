import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeGarageStatus } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { AppointmentStatusesList } from './AppointmentStatusesList'

function renderPage() {
  server.use(
    http.get('*/api/appointment-statuses/', () =>
      HttpResponse.json([
        makeGarageStatus(),
        makeGarageStatus({ id: 's2', key: 'WAITING', label: 'Waiting', is_system: false }),
      ]),
    ),
  )
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/appointment-statuses" element={<AppointmentStatusesList />} />
    </Routes>,
    { route: '/g1/settings/appointment-statuses' },
  )
}

const rowFor = async (label: string) => (await screen.findByText(label)).closest('tr')!

describe('AppointmentStatusesList', () => {
  it('explains the page in a tip beside the title', async () => {
    renderPage()
    expect(
      await screen.findByRole('button', { name: 'About Appointment Statuses' }),
    ).toHaveAccessibleDescription(/seven built-in ones can be renamed/)
  })

  it('opens the editor beneath the row and closes it again with Escape', async () => {
    const user = userEvent.setup()
    renderPage()
    const row = await rowFor('Booked in')
    const edit = within(row).getByRole('button', { name: 'Edit' })
    await user.click(edit)

    const panel = screen.getByRole('region', { name: 'Edit Booked in' })
    expect(row.nextElementSibling).toContainElement(panel)
    expect(within(panel).getByRole('textbox', { name: 'Label' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(edit).toHaveFocus()
  })

  it('saves a change and closes the panel', async () => {
    let body: unknown
    server.use(
      http.patch('*/api/appointment-statuses/:id', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(makeGarageStatus({ label: 'Arrived' }))
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(within(await rowFor('Booked in')).getByRole('button', { name: 'Edit' }))
    const label = screen.getByRole('textbox', { name: 'Label' })
    await user.clear(label)
    await user.type(label, 'Arrived')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Status updated.')).toBeInTheDocument()
    expect(body).toMatchObject({ label: 'Arrived', color: 'blue', sort_order: 1 })
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })

  it('keeps the owner-only message visible when the save is refused', async () => {
    server.use(
      http.patch('*/api/appointment-statuses/:id', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(within(await rowFor('Booked in')).getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Only the business owner can edit statuses.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Edit Booked in' })).toBeInTheDocument()
  })

  it('offers Delete only for statuses the business added', async () => {
    renderPage()
    expect(within(await rowFor('Booked in')).queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(within(await rowFor('Waiting')).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
