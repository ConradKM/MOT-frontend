import { describe, expect, it } from 'vitest'
import { http, HttpResponse, delay } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import { makeCustomer } from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { CustomerForm } from './CustomerForm'

function renderForm(route = '/g1/customers/new') {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/customers/new" element={<CustomerForm />} />
      <Route path="/:garageId/customers/:id/edit" element={<CustomerForm />} />
      <Route path="/:garageId/customers/:id" element={<h1>Customer detail</h1>} />
      <Route path="/:garageId/customers" element={<h1>Customers list</h1>} />
    </Routes>,
    { route },
  )
}

const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('First name'), 'Oliver')
  await user.type(screen.getByLabelText('Last name'), 'Bennett')
}

describe('CustomerForm — creating', () => {
  it('shows a create heading and empty fields', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: 'New customer' })).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('will not submit without the required name fields', async () => {
    let posted = false
    server.use(
      http.post('*/api/customers/', () => {
        posted = true
        return HttpResponse.json(makeCustomer())
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(posted).toBe(false)
    expect(screen.getByLabelText('First name')).toBeInvalid()
  })

  it('sends the entered details and navigates to the new customer', async () => {
    let body: unknown
    server.use(
      http.post('*/api/customers/', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(makeCustomer({ id: 'c99' }))
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.type(screen.getByLabelText('Email'), 'oliver@example.com')
    await user.type(screen.getByLabelText('Phone'), '07123456789')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Customer detail' })).toBeInTheDocument()
    expect(body).toEqual({
      first_name: 'Oliver',
      last_name: 'Bennett',
      email: 'oliver@example.com',
      phone: '07123456789',
    })
  })

  it('confirms the creation with a toast', async () => {
    server.use(http.post('*/api/customers/', () => HttpResponse.json(makeCustomer({ id: 'c99' }))))
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Customer created.')).toBeInTheDocument()
  })

  it('sends null, not an empty string, for the optional fields left blank', async () => {
    // The backend distinguishes "no email on file" from "" — sending "" would
    // fail its email validation.
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/customers/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeCustomer())
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(body.email).toBeNull())
    expect(body.phone).toBeNull()
  })

  it('prefills the phone when arriving from an unknown caller', async () => {
    renderForm('/g1/customers/new?phone=%2B447700900123')
    expect(screen.getByLabelText('Phone')).toHaveValue('+447700900123')
  })

  it('accepts a very long name and special characters without mangling them', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/customers/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeCustomer())
      }),
    )
    const awkward = "Ó'Súilleabháin-Ashworth"
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText('First name'), awkward)
    await user.type(screen.getByLabelText('Last name'), 'X'.repeat(200))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(body.first_name).toBe(awkward))
    expect(body.last_name).toHaveLength(200)
  })
})

describe('CustomerForm — server rejections', () => {
  it('shows the server’s per-field messages beside the fields', async () => {
    server.use(
      http.post('*/api/customers/', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'x',
            errors: { json: { email: ['Not a valid email address.'], phone: ['Bad number.'] } },
          },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.type(screen.getByLabelText('Email'), 'nope@nope')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Not a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Bad number.')).toBeInTheDocument()
    // Still on the form, with the user's input intact to correct.
    expect(screen.getByLabelText('Email')).toHaveValue('nope@nope')
  })

  it('shows a form-level message for a conflict', async () => {
    server.use(
      http.post('*/api/customers/', () =>
        HttpResponse.json(
          { code: 409, status: 'x', message: 'A customer with that email already exists.' },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('A customer with that email already exists.'),
    ).toBeInTheDocument()
  })

  it.each([
    [403, 'You do not have permission to do that.'],
    [500, 'Something went wrong on our end.'],
  ])('shows a form-level message for a %i', async (status, message) => {
    server.use(
      http.post('*/api/customers/', () =>
        HttpResponse.json({ code: status, status: 'x', message }, { status }),
      ),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('reports a network failure rather than silently doing nothing', async () => {
    server.use(http.post('*/api/customers/', () => HttpResponse.error()))
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/failed to fetch/i)).toBeInTheDocument()
  })

  it('clears a previous error when the form is resubmitted', async () => {
    let attempt = 0
    server.use(
      http.post('*/api/customers/', () => {
        attempt++
        return attempt === 1
          ? HttpResponse.json({ code: 500, status: 'x', message: 'Temporary glitch.' }, { status: 500 })
          : HttpResponse.json(makeCustomer({ id: 'c99' }))
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Temporary glitch.')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Customer detail' })).toBeInTheDocument()
  })
})

describe('CustomerForm — submission state', () => {
  it('disables the submit button while the request is in flight', async () => {
    server.use(
      http.post('*/api/customers/', async () => {
        await delay(50)
        return HttpResponse.json(makeCustomer({ id: 'c99' }))
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const saving = await screen.findByRole('button', { name: 'Saving…' })
    expect(saving).toBeDisabled()
    await screen.findByRole('heading', { name: 'Customer detail' })
  })

  it('creates exactly one customer when the save button is clicked repeatedly', async () => {
    // The disabled state is what protects against a double-created customer.
    let posts = 0
    server.use(
      http.post('*/api/customers/', async () => {
        posts++
        await delay(30)
        return HttpResponse.json(makeCustomer({ id: 'c99' }))
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    const save = screen.getByRole('button', { name: 'Save' })
    await user.tripleClick(save)

    await screen.findByRole('heading', { name: 'Customer detail' })
    expect(posts).toBe(1)
  })
})

describe('CustomerForm — editing', () => {
  it('loads the existing customer into the fields', async () => {
    server.use(
      http.get('*/api/customers/:id', () =>
        HttpResponse.json(
          makeCustomer({ id: 'c1', first_name: 'Nadia', last_name: 'Okafor', phone: null }),
        ),
      ),
    )
    renderForm('/g1/customers/c1/edit')
    expect(screen.getByRole('heading', { name: 'Edit customer' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('First name')).toHaveValue('Nadia'))
    // A null phone must render as an empty box, not the string "null".
    expect(screen.getByLabelText('Phone')).toHaveValue('')
  })

  it('saves an edit without announcing a creation', async () => {
    server.use(
      http.get('*/api/customers/:id', () => HttpResponse.json(makeCustomer({ id: 'c1' }))),
      http.patch('*/api/customers/:id', () => HttpResponse.json(makeCustomer({ id: 'c1' }))),
    )
    const user = userEvent.setup()
    renderForm('/g1/customers/c1/edit')
    await waitFor(() => expect(screen.getByLabelText('First name')).toHaveValue('Oliver'))

    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Olly')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Customer detail' })).toBeInTheDocument()
    expect(screen.queryByText('Customer created.')).not.toBeInTheDocument()
  })

  it('leaves without saving when cancelled', async () => {
    let posts = 0
    server.use(
      http.post('*/api/customers/', () => {
        posts++
        return HttpResponse.json(makeCustomer())
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(posts).toBe(0)
  })
})
