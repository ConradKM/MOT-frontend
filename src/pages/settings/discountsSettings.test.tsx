import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import {
  makeDiscountCode,
  makeEmployee,
  makeLoyaltyCode,
  makeLoyaltySettings,
  makeRole,
} from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { DiscountsSettings } from './DiscountsSettings'

function renderSettings() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/settings/discounts" element={<DiscountsSettings />} />
    </Routes>,
    { route: '/g1/settings/discounts' },
  )
}

function asStaffMember() {
  server.use(
    http.get('*/api/employees/', () =>
      HttpResponse.json([makeEmployee({ roles: [makeRole({ name: 'STAFF' })] })]),
    ),
  )
}

function serveCodes(items = [makeDiscountCode(), makeLoyaltyCode()], total = items.length) {
  const seen: URLSearchParams[] = []
  server.use(
    http.get('*/api/loyalty/codes', ({ request }) => {
      seen.push(new URL(request.url).searchParams)
      return HttpResponse.json({ items, total })
    }),
  )
  return seen
}

describe('DiscountsSettings — loyalty programme', () => {
  it('saves the rule an owner sets', async () => {
    let sent: unknown
    server.use(
      http.put('*/api/loyalty/settings', async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json(makeLoyaltySettings({ enabled: true }))
      }),
    )
    const user = userEvent.setup()
    renderSettings()

    await user.click(await screen.findByRole('switch', { name: 'Reward returning customers' }))
    const visits = screen.getByLabelText('Reward after every … completed visits')
    await user.clear(visits)
    await user.type(visits, '3')
    await user.selectOptions(screen.getByLabelText('Discount type'), 'FIXED')
    const value = screen.getByLabelText('Amount off (£)')
    await user.clear(value)
    await user.type(value, '7.5')
    await user.click(screen.getByRole('button', { name: 'Save loyalty programme' }))

    await waitFor(() =>
      expect(sent).toEqual({
        enabled: true,
        visits_required: 3,
        discount_type: 'FIXED',
        discount_value: '7.50',
        expiry_days: 90,
      }),
    )
    expect(await screen.findByText('Loyalty programme saved.')).toBeInTheDocument()
  })

  it('refuses an impossible rule before asking the server', async () => {
    let called = false
    server.use(
      http.put('*/api/loyalty/settings', () => {
        called = true
        return HttpResponse.json(makeLoyaltySettings())
      }),
    )
    const user = userEvent.setup()
    renderSettings()

    const visits = await screen.findByLabelText('Reward after every … completed visits')
    await user.clear(visits)
    await user.type(visits, '0')
    const value = screen.getByLabelText('Percentage off')
    await user.clear(value)
    await user.type(value, '150')
    await user.click(screen.getByRole('button', { name: 'Save loyalty programme' }))

    expect(screen.getByText('Enter a whole number from 1 to 100.')).toBeInTheDocument()
    expect(screen.getByText('A percentage can be at most 100.')).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('is read-only for staff who are not the owner', async () => {
    asStaffMember()
    renderSettings()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save loyalty programme' })).toBeDisabled(),
    )
    expect(screen.getAllByText('Only the business owner can change discounts.').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Create code' })).not.toBeInTheDocument()
  })
})

describe('DiscountsSettings — discount codes', () => {
  it('lists codes with source, customer, status and email outcome', async () => {
    serveCodes([
      makeDiscountCode(),
      makeLoyaltyCode({ status: 'USED', uses: 1 }),
      makeLoyaltyCode({
        id: 'dc3',
        code: 'LOYAL-NOEMAIL1',
        email_status: 'NO_EMAIL',
        customer: { id: 'c2', first_name: 'Grace', last_name: 'Hall', email: null, marketing_email_opt_out: false },
      }),
    ])
    renderSettings()

    const table = await screen.findByRole('table', { name: 'Discount codes' })
    const rows = within(table).getAllByRole('row')
    expect(within(rows[1]).getByText('SUMMER10')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Anyone')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Active')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Oliver Bennett')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Used')).toBeInTheDocument()
    expect(within(rows[2]).getByText('1 / 1')).toBeInTheDocument()
    expect(within(rows[3]).getByText(/No email on file/)).toBeInTheDocument()
  })

  it('shows an empty state, and a different one when filters match nothing', async () => {
    serveCodes([], 0)
    const user = userEvent.setup()
    renderSettings()
    expect(await screen.findByText(/No discount codes yet/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Status'), 'EXPIRED')
    expect(await screen.findByText('No codes match these filters.')).toBeInTheDocument()
  })

  it('filters, searches and pages on the server', async () => {
    const seen = serveCodes(
      Array.from({ length: 25 }, (_, i) => makeDiscountCode({ id: `d${i}`, code: `CODE${i}` })),
      30,
    )
    const user = userEvent.setup()
    renderSettings()
    expect(await screen.findByText('Showing 1–25 of 30')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(seen.at(-1)?.get('offset')).toBe('25'))

    await user.selectOptions(screen.getByLabelText('Source'), 'LOYALTY')
    await waitFor(() => expect(seen.at(-1)?.get('source')).toBe('LOYALTY'))
    expect(seen.at(-1)?.get('offset')).toBe('0')

    await user.type(screen.getByLabelText('Search codes'), 'oliver')
    await waitFor(() => expect(seen.at(-1)?.get('search')).toBe('oliver'))
  })

  it('creates a promo code with limits', async () => {
    serveCodes([])
    let sent: Record<string, unknown> | undefined
    server.use(
      http.post('*/api/loyalty/codes', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeDiscountCode({ code: 'SPRING-5' }), { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderSettings()

    await user.click(await screen.findByRole('button', { name: 'Create code' }))
    const panel = screen.getByRole('region', { name: 'Create a discount code' })
    await user.type(within(panel).getByLabelText('Code'), 'spring-5')
    await user.type(within(panel).getByLabelText('Percentage off'), '5')
    await user.type(within(panel).getByLabelText('Total uses allowed'), '50')
    await user.click(within(panel).getByRole('button', { name: 'Create code' }))

    await waitFor(() => expect(sent).toBeDefined())
    expect(sent).toMatchObject({
      code: 'SPRING-5',
      discount_type: 'PERCENTAGE',
      discount_value: '5.00',
      max_uses: 50,
      max_uses_per_customer: null,
    })
    expect(await screen.findByText('Created SPRING-5.')).toBeInTheDocument()
  })

  it('shows the server refusing a duplicate code on the field', async () => {
    serveCodes([])
    server.use(
      http.post('*/api/loyalty/codes', () =>
        HttpResponse.json(
          { code: 409, message: 'A code like this already exists.', errors: { json: { code: ['A code like this already exists.'] } } },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Create code' }))
    const panel = screen.getByRole('region', { name: 'Create a discount code' })
    await user.type(within(panel).getByLabelText('Code'), 'summer10')
    await user.type(within(panel).getByLabelText('Percentage off'), '10')
    await user.click(within(panel).getByRole('button', { name: 'Create code' }))
    expect((await within(panel).findAllByText('A code like this already exists.')).length).toBeGreaterThan(0)
  })

  it('disables a code and resends a loyalty email from the expanded row', async () => {
    serveCodes()
    const patches: unknown[] = []
    let resent = false
    server.use(
      http.patch('*/api/loyalty/codes/:id', async ({ request }) => {
        patches.push(await request.json())
        return HttpResponse.json(makeDiscountCode({ status: 'DISABLED', stored_status: 'DISABLED' }))
      }),
      http.post('*/api/loyalty/codes/:id/resend', () => {
        resent = true
        return HttpResponse.json(makeLoyaltyCode())
      }),
    )
    const user = userEvent.setup()
    renderSettings()

    const manage = await screen.findAllByRole('button', { name: 'Manage' })
    await user.click(manage[0])
    const promo = screen.getByRole('region', { name: 'Manage SUMMER10' })
    await user.click(within(promo).getByRole('button', { name: 'Disable code' }))
    await waitFor(() => expect(patches).toEqual([{ status: 'DISABLED' }]))

    // The open row's toggle now reads "Close" - the loyalty row is the one Manage left.
    await user.click(screen.getByRole('button', { name: 'Manage' }))
    const loyalty = screen.getByRole('region', { name: 'Manage LOYAL-7KQ2M9XA' })
    // Loyalty codes are always single-use: no use limits to edit.
    expect(within(loyalty).queryByLabelText('Total uses allowed')).not.toBeInTheDocument()
    await user.click(within(loyalty).getByRole('button', { name: 'Resend email' }))
    await waitFor(() => expect(resent).toBe(true))
    expect(await screen.findByText('Email sent to oliver@example.com.')).toBeInTheDocument()
  })

  it('lets staff see a code but not change it', async () => {
    asStaffMember()
    serveCodes([makeDiscountCode()])
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Details' }))
    const panel = screen.getByRole('region', { name: 'Manage SUMMER10' })
    expect(within(panel).queryByRole('button', { name: 'Disable code' })).not.toBeInTheDocument()
    expect(within(panel).getByLabelText('Valid until')).toBeDisabled()
  })

  it('has no axe violations with the table and an open editor', async () => {
    serveCodes()
    const user = userEvent.setup()
    const { container } = renderSettings()
    await user.click((await screen.findAllByRole('button', { name: 'Manage' }))[1])
    await user.click(screen.getByRole('button', { name: 'Create code' }))
    await expectNoA11yViolations(container)
  })
})
