import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../test/msw/server'
import {
  makeBasicInsights,
  makeEmployee,
  makeInsights,
  makeInsightsSummary,
  makeRole,
  makeStaffInsights,
} from '../../test/fixtures'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { expectNoA11yViolations } from '../../test/a11y'
import { InsightsOverview } from './InsightsOverview'

// The chart itself is Recharts, which jsdom can't lay out - and this flag
// proves when its module is actually loaded (the lazy-load guarantee).
const loaded = vi.hoisted(() => ({ chart: false }))
vi.mock('./charts/TrendChart', () => {
  loaded.chart = true
  return { default: () => <div data-testid="trend-chart" /> }
})

const saveBlob = vi.hoisted(() => vi.fn())
vi.mock('../../lib/download', () => ({ saveBlob }))

const TODAY = '2026-03-31'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${TODAY}T09:00:00Z`))
  saveBlob.mockReset()
})
afterEach(() => vi.useRealTimers())

function serve(payload: unknown, seen: URL[] = []) {
  server.use(
    http.get('*/api/insights', ({ request }) => {
      seen.push(new URL(request.url))
      return HttpResponse.json(payload)
    }),
  )
  return seen
}

function asStaffMember() {
  // Signed in as e1, who has no OWNER role.
  server.use(
    http.get('*/api/employees/', () =>
      HttpResponse.json([makeEmployee({ roles: [makeRole({ name: 'STAFF' })] })]),
    ),
  )
}

function withTeam() {
  server.use(
    http.get('*/api/employees/', () =>
      HttpResponse.json([
        makeEmployee(),
        makeEmployee({ id: 'e2', first_name: 'Sam', last_name: 'Stylist', roles: [makeRole({ name: 'STAFF' })] }),
      ]),
    ),
  )
}

const card = (label: string) => screen.getByRole('group', { name: label })

function renderPage() {
  signInAsStaff()
  return renderWithAppProviders(
    <Routes>
      <Route path="/:garageId/insights" element={<InsightsOverview />} />
    </Routes>,
    { route: '/g1/insights' },
  )
}

// First: the module mock is cached once loaded, so the never-loaded case
// has to run before anything renders a chart.
describe('Insights — plan', () => {
  it('shows locked advanced panels as an upsell, keeps the basics, and hides Export', async () => {
    serve(makeBasicInsights())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Top services' })).toBeInTheDocument()
    expect(screen.getAllByText('Not on your plan')).toHaveLength(4)
    for (const link of screen.getAllByRole('link', { name: /Upgrade/ })) {
      expect(link).toHaveAttribute('href', 'https://comaz.co.uk/pricing')
    }
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    // Recharts is never fetched for a plan that can't show a chart.
    expect(loaded.chart).toBe(false)
  })
})

describe('Insights — owner', () => {
  it('shows the money cards with honest labels and comparisons', async () => {
    serve(makeInsights())
    renderPage()

    expect(await screen.findByRole('group', { name: 'Booked value' })).toHaveTextContent('£80.00')
    expect(screen.getByText('£35.00 lost to 2 no-shows and cancellations · 1 appointment had no price')).toBeInTheDocument()
    expect(screen.getByText('Deposits collected')).toBeInTheDocument()
    // 80 vs 40 booked; 6 vs 4 appointments.
    expect(card('Booked value')).toHaveTextContent('+100% vs previous 31 days')
    expect(card('Appointments')).toHaveTextContent('+50% vs previous 31 days')
    // Rates compare in points, not percentages of percentages.
    expect(card('No-show rate')).toHaveTextContent('+25 pts vs previous 31 days')
    // Nothing collected before, so there is no honest percentage.
    expect(card('Deposits collected')).toHaveTextContent('New this period (vs previous 31 days)')
  })

  it('shows n/a, with an explanation, for a rate with nothing to measure', async () => {
    serve(makeInsights({ summary: makeInsightsSummary({ returning_rate: null }) }))
    renderPage()

    const returning = await screen.findByRole('group', { name: 'Returning rate' })
    expect(returning).toHaveTextContent(/^Returning rate.*n\/a/)
    expect(within(returning).getByText(/nothing to measure yet/)).toBeInTheDocument()
    expect(returning).toHaveTextContent('n/a vs previous 31 days')
  })

  it('renders every advanced panel, with the chart loaded only now', async () => {
    serve(makeInsights())
    renderPage()

    expect(await screen.findByTestId('trend-chart')).toBeInTheDocument()
    expect(loaded.chart).toBe(true)
    for (const title of ['Trend', 'Top services', 'Busy days and times', 'Staff', 'Customers']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('Busiest: Mondays at 10:00 (3 appointments).')).toBeInTheDocument()
    expect(screen.getByText('Sam Stylist had the most appointments (5).')).toBeInTheDocument()
  })

  it('pairs the trend chart with a table of the same numbers', async () => {
    serve(makeInsights())
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('Show as a table'))
    const table = screen.getByRole('table', { name: 'Appointments per day' })
    expect(within(table).getByRole('row', { name: 'Tue 3 Mar 4' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Booked value' }))
    expect(screen.getByRole('table', { name: 'Booked value per day' })).toBeInTheDocument()
  })

  it('lists who is due back with links to the customer and to book them in', async () => {
    serve(makeInsights())
    renderPage()

    const olive = await screen.findByRole('link', { name: 'Olive Green' })
    expect(olive).toHaveAttribute('href', '/g1/customers/c1')
    expect(screen.getByRole('link', { name: 'Book in Olive Green' })).toHaveAttribute(
      'href',
      '/g1/appointments/new?customer_id=c1',
    )
    expect(screen.getByText('1 due now, 1 due in the next 14 days.')).toBeInTheDocument()
    expect(screen.getByText('MOT expiry')).toBeInTheDocument()
  })

  it('switches range and asks for that period', async () => {
    const seen = serve(makeInsights())
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('group', { name: 'Booked value' })

    await user.selectOptions(screen.getByLabelText('Period'), 'last7')
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('start')).toBe('2026-03-25'))
    expect(seen.at(-1)?.searchParams.get('end')).toBe(TODAY)

    await user.selectOptions(screen.getByLabelText('Period'), 'lastMonth')
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('start')).toBe('2026-02-01'))
    expect(seen.at(-1)?.searchParams.get('end')).toBe('2026-02-28')
  })

  it('refuses a backwards custom range without asking the API', async () => {
    const seen = serve(makeInsights())
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('group', { name: 'Booked value' })
    const before = seen.length

    await user.selectOptions(screen.getByLabelText('Period'), 'custom')
    const from = screen.getByLabelText('From')
    await user.clear(from)
    await user.type(from, '2026-04-10')

    expect(await screen.findByRole('alert')).toHaveTextContent('The end date must be on or after the start date.')
    expect(seen.length).toBe(before)
  })

  it('filters to one member of staff', async () => {
    withTeam()
    const seen = serve(makeInsights())
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Staff' }), 'e2')
    await waitFor(() => expect(seen.at(-1)?.searchParams.get('employee_id')).toBe('e2'))
  })

  it('downloads the CSV for the chosen period', async () => {
    const seen: URL[] = []
    serve(makeInsights())
    server.use(
      http.get('*/api/insights/export.csv', ({ request }) => {
        seen.push(new URL(request.url))
        return new HttpResponse('Date,Time\n', { headers: { 'Content-Type': 'text/csv' } })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(saveBlob).toHaveBeenCalled())
    expect(saveBlob.mock.calls[0][1]).toBe('insights-2026-03-02-to-2026-03-31.csv')
    expect(seen[0].searchParams.get('start')).toBe('2026-03-02')
  })

  it('has no detectable accessibility violations', async () => {
    serve(makeInsights())
    const { container } = renderPage()
    await screen.findByTestId('trend-chart')
    await expectNoA11yViolations(container)
  })
})

describe('Insights — staff', () => {
  it('shows counts only: no £ anywhere, no money cards, no staff table or filter', async () => {
    asStaffMember()
    serve(makeStaffInsights())
    const { container } = renderPage()

    expect(await screen.findByRole('group', { name: 'Appointments' })).toBeInTheDocument()
    expect(screen.getByText('How your appointments are going.')).toBeInTheDocument()
    expect(container.textContent).not.toContain('£')
    expect(screen.queryByRole('group', { name: 'Booked value' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Deposits collected' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Staff' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Staff' })).not.toBeInTheDocument()
    // The trend has no booked-value series to pick.
    expect(screen.queryByRole('radio', { name: 'Booked value' })).not.toBeInTheDocument()
  })
})

describe('Insights — states', () => {
  it('says so when the period is empty', async () => {
    serve(
      makeInsights({
        summary: makeInsightsSummary({
          appointments: {
            total: 0,
            by_status: {},
            completed: 0,
            no_show: 0,
            cancelled: 0,
            upcoming: 0,
            completion_rate: null,
            no_show_rate: null,
            cancellation_rate: null,
          },
        }),
      }),
    )
    renderPage()
    expect(await screen.findByText('No appointments in this period yet.')).toBeInTheDocument()
  })

  it('offers a retry when loading fails', async () => {
    let calls = 0
    server.use(
      http.get('*/api/insights', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json({ code: 500, status: 'Internal Server Error', message: 'Boom' }, { status: 500 })
          : HttpResponse.json(makeInsights())
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('group', { name: 'Booked value' })).toHaveTextContent('£80.00')
  })
})
