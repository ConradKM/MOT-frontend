import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeEmployee, makeRole } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { EmployeesList } from './EmployeesList'

function renderPage() {
  server.use(
    http.get('*/api/employees/', () =>
      HttpResponse.json([
        makeEmployee(),
        makeEmployee({
          id: 'e2',
          first_name: 'Amy',
          last_name: 'Fox',
          email: 'amy@bennett.example',
          roles: [makeRole({ id: 'r2', name: 'STAFF' })],
        }),
      ]),
    ),
    http.get('*/api/roles/', () =>
      HttpResponse.json([makeRole(), makeRole({ id: 'r2', name: 'STAFF' })]),
    ),
  )
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/employees" element={<EmployeesList />} />
    </Routes>,
    { route: '/g1/settings/employees' },
  )
}

const rowFor = async (text: string) => (await screen.findByText(text)).closest('tr')!

describe('EmployeesList', () => {
  it('opens one editor at a time, each beneath its own row', async () => {
    const user = userEvent.setup()
    renderPage()
    const greg = await rowFor('greg@bennett.example')
    const amy = await rowFor('amy@bennett.example')

    await user.click(within(greg).getByRole('button', { name: 'Edit' }))
    expect(greg.nextElementSibling).toContainElement(
      screen.getByRole('region', { name: 'Edit Greg Mason' }),
    )
    expect(screen.getByRole('textbox', { name: 'First name' })).toHaveFocus()

    await user.click(within(amy).getByRole('button', { name: 'Edit' }))
    expect(screen.queryByRole('region', { name: 'Edit Greg Mason' })).not.toBeInTheDocument()
    expect(amy.nextElementSibling).toContainElement(
      screen.getByRole('region', { name: 'Edit Amy Fox' }),
    )
    // Both summary rows are still on the page.
    expect(screen.getByText('greg@bennett.example')).toBeInTheDocument()
  })

  it('saves the edited details and roles', async () => {
    let body: unknown
    server.use(
      http.patch('*/api/employees/:id', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(makeEmployee({ id: 'e2' }))
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(
      within(await rowFor('amy@bennett.example')).getByRole('button', { name: 'Edit' }),
    )
    const panel = screen.getByRole('region', { name: 'Edit Amy Fox' })
    await user.click(within(panel).getByRole('button', { name: 'OWNER' }))
    await user.click(within(panel).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Employee updated.')).toBeInTheDocument()
    expect(body).toMatchObject({ first_name: 'Amy', last_name: 'Fox', role_ids: ['r2', 'r1'] })
  })

  it('Cancel closes the editor and returns focus to its Edit button', async () => {
    const user = userEvent.setup()
    renderPage()
    const edit = within(await rowFor('amy@bennett.example')).getByRole('button', { name: 'Edit' })
    await user.click(edit)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(edit).toHaveFocus()
  })
})
