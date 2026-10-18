import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeAppointmentType, makeEmployee, makeRole } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { AppointmentTypesList } from './AppointmentTypesList'

function serveTypes(types = [makeAppointmentType({ id: 'at1' })]) {
  server.use(http.get('*/api/appointment-types/', () => HttpResponse.json(types)))
}

function renderPage() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/appointment-types" element={<AppointmentTypesList />} />
    </Routes>,
    { route: '/g1/appointment-types' },
  )
}

async function openAddForm(user: ReturnType<typeof userEvent.setup>) {
  // The Disclosure toggle and the form's submit button share the same
  // accessible name ("Add appointment type") - the toggle is the only one
  // that exists before the form is open.
  await user.click(await screen.findByRole('button', { name: 'Add appointment type' }))
}

/** The form's submit button - once open, it's the *second* element with
 * this accessible name (the Disclosure toggle is the first). */
function submitButton() {
  const matches = screen.getAllByRole('button', { name: 'Add appointment type' })
  return matches[matches.length - 1]
}

describe('AppointmentTypesList — deposit settings', () => {
  it('does not show deposit fields until the toggle is switched on', async () => {
    serveTypes([])
    const user = userEvent.setup()
    renderPage()

    await openAddForm(user)
    expect(screen.queryByText('Deposit type')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Require a deposit to book this service'))
    expect(screen.getByText('Deposit type')).toBeInTheDocument()
  })

  it('previews the deposit and remaining balance for a fixed amount', async () => {
    serveTypes([])
    const user = userEvent.setup()
    renderPage()

    await openAddForm(user)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'MOT')
    await user.type(screen.getByPlaceholderText('e.g. 54.85'), '100')
    await user.click(screen.getByLabelText('Require a deposit to book this service'))
    await user.type(screen.getByPlaceholderText('e.g. 20.00'), '20')

    expect(screen.getByText('Service price: £100.00')).toBeInTheDocument()
    expect(screen.getByText('Deposit: £20.00')).toBeInTheDocument()
    expect(screen.getByText('Remaining balance: £80.00')).toBeInTheDocument()
  })

  it('previews a percentage deposit once a service price is set', async () => {
    serveTypes([])
    const user = userEvent.setup()
    renderPage()

    await openAddForm(user)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'Full Service')
    await user.click(screen.getByLabelText('Require a deposit to book this service'))
    await user.selectOptions(screen.getByLabelText('Deposit type'), 'PERCENTAGE')
    await user.type(screen.getByPlaceholderText('e.g. 25'), '25')

    // No price yet - can't preview a percentage deposit.
    expect(
      screen.getByText('Set a service price above to calculate a percentage deposit.'),
    ).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('e.g. 54.85'), '200')
    expect(screen.getByText('Deposit: £50.00')).toBeInTheDocument()
  })

  it('surfaces a server-side validation error next to the deposit field', async () => {
    serveTypes([])
    server.use(
      http.post('*/api/appointment-types/', () =>
        HttpResponse.json(
          {
            errors: { json: { deposit_value: ['A fixed deposit cannot exceed the service price.'] } },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await openAddForm(user)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'MOT')
    await user.type(screen.getByPlaceholderText('e.g. 54.85'), '50')
    await user.click(screen.getByLabelText('Require a deposit to book this service'))
    await user.type(screen.getByPlaceholderText('e.g. 20.00'), '75')
    await user.click(submitButton())

    await waitFor(() =>
      expect(
        screen.getByText('A fixed deposit cannot exceed the service price.'),
      ).toBeInTheDocument(),
    )
  })

  it('creates a type with a deposit and shows the badge in the list', async () => {
    const types: ReturnType<typeof makeAppointmentType>[] = []
    server.use(
      http.get('*/api/appointment-types/', () => HttpResponse.json(types)),
      http.post('*/api/appointment-types/', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        const created = makeAppointmentType({
          id: 'at-new',
          name: body.name as string,
          base_price: body.base_price as string,
          deposit_required: true,
          deposit_type: 'FIXED',
          deposit_value: '20.00',
        })
        types.push(created)
        return HttpResponse.json(created, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await openAddForm(user)
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[0], 'MOT')
    await user.type(screen.getByPlaceholderText('e.g. 54.85'), '100')
    await user.click(screen.getByLabelText('Require a deposit to book this service'))
    await user.type(screen.getByPlaceholderText('e.g. 20.00'), '20')
    await user.click(submitButton())

    await waitFor(() => expect(screen.getByText('Deposit: £20.00')).toBeInTheDocument())
  })
})

describe('AppointmentTypesList — checklist link', () => {
  function serveTemplate(exists: boolean) {
    server.use(
      http.get('*/api/appointment-types/:id/checklist-template', () =>
        exists
          ? HttpResponse.json({ id: 'ct1', appointment_type_id: 'at1', items: [] })
          : HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    )
  }
  function serveEmployeeRole(role: string) {
    server.use(
      http.get('*/api/employees/', () =>
        HttpResponse.json([makeEmployee({ roles: [makeRole({ name: role })] })]),
      ),
    )
  }

  it('offers an owner "Edit checklist" when one exists, and nothing else checklist-related', async () => {
    serveTypes()
    serveTemplate(true)
    renderPage()
    const link = await screen.findByRole('link', { name: 'Edit checklist' })
    expect(link).toHaveAttribute('href', '/g1/appointment-types/at1/checklist/build')
    expect(screen.queryByRole('link', { name: 'View checklist' })).not.toBeInTheDocument()
  })

  it('offers an owner "Build checklist" when none exists yet', async () => {
    serveTypes()
    serveTemplate(false)
    renderPage()
    expect(await screen.findByRole('link', { name: 'Build checklist' })).toHaveAttribute(
      'href',
      '/g1/appointment-types/at1/checklist/build',
    )
  })

  it('offers a non-owner only "View checklist", and only when one exists', async () => {
    serveTypes()
    serveTemplate(true)
    serveEmployeeRole('STAFF')
    renderPage()
    expect(await screen.findByRole('link', { name: 'View checklist' })).toHaveAttribute(
      'href',
      '/g1/appointment-types/at1/checklist',
    )
    expect(screen.queryByRole('link', { name: /Edit checklist|Build checklist/ })).not.toBeInTheDocument()
  })

  it('shows a non-owner no checklist link when there is no checklist', async () => {
    serveTypes()
    serveTemplate(false)
    serveEmployeeRole('STAFF')
    renderPage()
    await screen.findByRole('link', { name: 'Add-ons' })
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /checklist/i })).not.toBeInTheDocument(),
    )
  })
})

describe('AppointmentTypesList — editing', () => {
  it('opens the edit form beneath the row, leaving the row in place', async () => {
    serveTypes([makeAppointmentType({ id: 'at1', name: 'MOT test' })])
    const user = userEvent.setup()
    renderPage()

    const name = await screen.findByText('MOT test')
    const row = name.closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Edit' }))

    const panel = screen.getByRole('region', { name: 'Edit MOT test' })
    expect(name).toBeInTheDocument()
    expect(row.nextElementSibling).toContainElement(panel)
    expect(within(panel).getAllByRole('textbox')[0]).toHaveFocus()

    await user.click(within(row).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('region', { name: 'Edit MOT test' })).not.toBeInTheDocument()
  })

  it('keeps the owner-only message visible when a save is refused', async () => {
    serveTypes([makeAppointmentType({ id: 'at1', name: 'MOT test' })])
    server.use(
      http.patch('*/api/appointment-types/:id', () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    )
    const user = userEvent.setup()
    renderPage()
    const row = (await screen.findByText('MOT test')).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Only the business owner can edit appointment types.'),
    ).toBeInTheDocument()
  })
})
