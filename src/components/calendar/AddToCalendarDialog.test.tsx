import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse, delay } from 'msw'
import { AddToCalendarDialog } from './AddToCalendarDialog'
import type { CalendarFeed, CalendarFeedWithUrl } from '../../api/calendarExport'
import { renderWithAppProviders, signInAsStaff } from '../../test/utils'
import { server } from '../../test/msw/server'
import { makeAppointmentType, makeEmployee, makeRole } from '../../test/fixtures'
import { expectNoA11yViolations } from '../../test/a11y'

const TOKEN = 'A'.repeat(43)
const ICS = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'

const owner = makeEmployee()
const sam = makeEmployee({
  id: 'e2',
  first_name: 'Sam',
  last_name: 'Spanner',
  roles: [makeRole({ id: 'r2', name: 'STAFF' })],
})
const types = [makeAppointmentType(), makeAppointmentType({ id: 'at2', name: 'Full service' })]

function makeFeed(patch: Partial<CalendarFeed> = {}): CalendarFeed {
  return {
    id: 'f1',
    name: 'My phone',
    scope: 'ME',
    employee_ids: [],
    appointment_type_ids: null,
    days_back: 7,
    days_forward: 90,
    created_by_employee_id: 'e1',
    created_at: '2026-03-01T09:00:00Z',
    last_accessed_at: null,
    ...patch,
  }
}

function withUrl(feed: CalendarFeed, token = TOKEN): CalendarFeedWithUrl {
  return {
    ...feed,
    subscription_url: `https://api.example.test/api/calendar-feeds/${token}.ics`,
    webcal_url: `webcal://api.example.test/api/calendar-feeds/${token}.ics`,
  }
}

interface Setup {
  employees?: ReturnType<typeof makeEmployee>[]
  feeds?: CalendarFeed[]
  initialRange?: { start: string; end: string }
  initialEmployeeId?: string
}

function setup({ employees = [owner, sam], feeds = [], initialRange, initialEmployeeId }: Setup = {}) {
  const downloads: URLSearchParams[] = []
  server.use(
    http.get('*/api/employees/', () => HttpResponse.json(employees)),
    http.get('*/api/appointment-types/', () => HttpResponse.json(types)),
    http.get('*/api/calendar-export/feeds', () => HttpResponse.json(feeds)),
    http.get('*/api/calendar-export/appointments.ics', ({ request }) => {
      downloads.push(new URL(request.url).searchParams)
      return new HttpResponse(ICS, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } })
    }),
  )
  const onClose = vi.fn()
  const utils = renderWithAppProviders(
    <AddToCalendarDialog
      open
      onClose={onClose}
      initialRange={initialRange}
      initialEmployeeId={initialEmployeeId}
    />,
  )
  return { ...utils, downloads, onClose }
}

let saved: { href: string; download: string }[]

beforeEach(() => {
  signInAsStaff('e1')
  saved = []
  vi.stubGlobal('URL', Object.assign(globalThis.URL, {
    createObjectURL: vi.fn(() => 'blob:calendar'),
    revokeObjectURL: vi.fn(),
  }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ href: this.href, download: this.download })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const scopeRadios = () =>
  within(screen.getByRole('group', { name: 'Whose calendar' })).queryAllByRole('radio')

describe('AddToCalendarDialog — whose calendar', () => {
  it('offers an owner every option, defaulting to all workers on an unfiltered calendar', async () => {
    setup()
    await waitFor(() => expect(scopeRadios()).toHaveLength(3))
    expect(screen.getByRole('radio', { name: 'All workers' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Just me' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Selected workers' })).toBeInTheDocument()
  })

  it('offers STAFF only "Just me" and always exports scope=ME', async () => {
    const staffMe = makeEmployee({ roles: [makeRole({ name: 'STAFF' })] })
    const { downloads } = setup({ employees: [staffMe, sam], initialEmployeeId: 'e2' })
    await screen.findByText('MOT test')
    expect(scopeRadios()).toHaveLength(1)
    expect(screen.getByRole('radio', { name: 'Just me' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'All workers' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Download .ics file' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].get('scope')).toBe('ME')
    expect(downloads[0].getAll('employee_ids')).toEqual([])
  })

  it("pre-fills from the calendar's worker filter and visible range", async () => {
    const { downloads } = setup({
      initialEmployeeId: 'e2',
      initialRange: { start: '2026-03-09', end: '2026-03-15' },
    })
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Selected workers' })).toBeChecked())
    expect(screen.getByRole('checkbox', { name: 'Sam Spanner' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Custom' })).toBeChecked()
    expect(screen.getByLabelText('From')).toHaveValue('2026-03-09')

    fireEvent.click(screen.getByRole('button', { name: 'Download .ics file' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].toString()).toBe(
      'scope=SELECTED&start_date=2026-03-09&end_date=2026-03-15&employee_ids=e2',
    )
  })
})

describe('AddToCalendarDialog — download', () => {
  it('sends the chosen workers and types, then saves the file', async () => {
    const { downloads } = setup({ initialRange: { start: '2026-03-01', end: '2026-03-31' } })
    await screen.findByRole('radio', { name: 'Selected workers' })
    fireEvent.click(screen.getByRole('radio', { name: 'Selected workers' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sam Spanner' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Full service' }))

    fireEvent.click(screen.getByRole('button', { name: 'Download .ics file' }))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(downloads[0].getAll('employee_ids')).toEqual(['e2'])
    expect(downloads[0].getAll('appointment_type_ids')).toEqual(['at1'])
    expect(saved[0]).toEqual({ href: 'blob:calendar', download: 'appointments.ics' })
    expect(await screen.findByText(/Calendar file downloaded/)).toBeInTheDocument()
  })

  it('treats every type selected as "all types" (no type filter sent)', async () => {
    const { downloads } = setup()
    await screen.findByText('Full service')
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText('Choose at least one appointment type.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download .ics file' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Download .ics file' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].has('appointment_type_ids')).toBe(false)
  })

  it('blocks a range over the maximum before asking the server', async () => {
    setup({ initialRange: { start: '2026-01-01', end: '2027-01-02' } })
    expect(await screen.findByText('Choose a range of at most 366 days.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download .ics file' })).toBeDisabled()
  })

  it("shows the server's 422 'narrow it' message and saves nothing", async () => {
    setup()
    server.use(
      http.get('*/api/calendar-export/appointments.ics', () =>
        HttpResponse.json(
          {
            code: 422,
            status: 'Unprocessable Entity',
            message: 'This would export 6000 appointments; the limit is 5000. Narrow the date range, workers or appointment types.',
          },
          { status: 422 },
        ),
      ),
    )
    await screen.findByText('MOT test')
    fireEvent.click(screen.getByRole('button', { name: 'Download .ics file' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Narrow the date range')
    expect(saved).toEqual([])
  })

  it('shows a loading state while the file is prepared', async () => {
    setup()
    server.use(
      http.get('*/api/calendar-export/appointments.ics', async () => {
        await delay(50)
        return new HttpResponse(ICS)
      }),
    )
    await screen.findByText('MOT test')
    fireEvent.click(screen.getByRole('button', { name: 'Download .ics file' }))
    expect(await screen.findByRole('button', { name: 'Preparing…' })).toBeDisabled()
    await waitFor(() => expect(saved).toHaveLength(1))
  })
})

describe('AddToCalendarDialog — subscribe', () => {
  const openSubscribe = async () => {
    fireEvent.click(await screen.findByRole('tab', { name: 'Subscribe (stays updated)' }))
  }

  it('creates a link and shows its URL once, with Apple, Google, copy and QR', async () => {
    let body: Record<string, unknown> | undefined
    setup()
    server.use(
      http.post('*/api/calendar-export/feeds', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(withUrl(makeFeed({ name: 'Workshop', scope: 'ALL' })), { status: 201 })
      }),
    )
    await screen.findByRole('radio', { name: 'All workers' })
    await openSubscribe()
    fireEvent.change(screen.getByRole('textbox', { name: 'Link name' }), { target: { value: 'Workshop' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'and the next' }), { target: { value: '365' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create subscription link' }))

    expect(await screen.findByText(/only time this link is shown/)).toBeInTheDocument()
    expect(body).toEqual({
      name: 'Workshop',
      scope: 'ALL',
      employee_ids: [],
      appointment_type_ids: null,
      days_back: 7,
      days_forward: 365,
    })
    expect(screen.getByRole('textbox', { name: 'Calendar link' })).toHaveValue(
      `https://api.example.test/api/calendar-feeds/${TOKEN}.ics`,
    )
    expect(screen.getByRole('link', { name: 'Add to Apple Calendar' })).toHaveAttribute(
      'href',
      `webcal://api.example.test/api/calendar-feeds/${TOKEN}.ics`,
    )
    expect(screen.getByText('From URL')).toBeInTheDocument()
    expect(screen.getByText(/Google can take several hours/)).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'QR code for the calendar link' })).toBeInTheDocument()

    // Dismissed, the URL is gone for good - nothing on the page can show it again.
    fireEvent.click(screen.getByRole('button', { name: 'I’ve saved my link' }))
    await waitFor(() => expect(document.body.innerHTML).not.toContain(TOKEN))
  })

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    setup()
    server.use(
      http.post('*/api/calendar-export/feeds', () =>
        HttpResponse.json(withUrl(makeFeed()), { status: 201 }),
      ),
    )
    await openSubscribe()
    fireEvent.click(screen.getByRole('button', { name: 'Create subscription link' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`https://api.example.test/api/calendar-feeds/${TOKEN}.ics`),
    )
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
  })

  it('lists links without ever showing a URL, with usage and creator', async () => {
    setup({
      feeds: [
        makeFeed({ last_accessed_at: '2026-03-05T10:00:00Z' }),
        makeFeed({ id: 'f2', name: "Sam's link", created_by_employee_id: 'e2', scope: 'ME' }),
      ],
    })
    await openSubscribe()
    const list = await screen.findByRole('list')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(/Last used/)
    expect(rows[1]).toHaveTextContent('By Sam Spanner')
    expect(rows[1]).toHaveTextContent('Never used')
    expect(list.innerHTML).not.toMatch(/calendar-feeds|webcal/)
    // An owner may revoke someone else's link, but only its creator regenerates it.
    expect(within(rows[1]).queryByRole('button', { name: /Regenerate/ })).not.toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: /Revoke/ })).toBeInTheDocument()
  })

  it('regenerates only after confirmation, then shows the new URL once', async () => {
    let regenerated = 0
    const { onClose } = setup({ feeds: [makeFeed()] })
    server.use(
      http.post('*/api/calendar-export/feeds/f1/regenerate', () => {
        regenerated += 1
        return HttpResponse.json(withUrl(makeFeed(), 'B'.repeat(43)))
      }),
    )
    await openSubscribe()
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate link My phone' }))
    expect(screen.getByRole('dialog', { name: 'Regenerate this link?' })).toBeInTheDocument()

    // Escape cancels the confirmation, not the whole dialog.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Regenerate this link?' })).not.toBeInTheDocument())
    expect(regenerated).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate link My phone' }))
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    expect(await screen.findByRole('textbox', { name: 'Calendar link' })).toHaveValue(
      `https://api.example.test/api/calendar-feeds/${'B'.repeat(43)}.ics`,
    )
    expect(regenerated).toBe(1)
  })

  it('revokes only after confirmation', async () => {
    let revoked = ''
    setup({ feeds: [makeFeed()] })
    server.use(
      http.delete('*/api/calendar-export/feeds/:id', ({ params }) => {
        revoked = String(params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await openSubscribe()
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke link My phone' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(revoked).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Revoke link My phone' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await waitFor(() => expect(revoked).toBe('f1'))
    expect(await screen.findByText('Link revoked.')).toBeInTheDocument()
  })

  it('shows the cap message when creating fails', async () => {
    setup()
    server.use(
      http.post('*/api/calendar-export/feeds', () =>
        HttpResponse.json(
          { code: 422, status: 'Unprocessable Entity', message: 'You already have 10 calendar links.' },
          { status: 422 },
        ),
      ),
    )
    await openSubscribe()
    fireEvent.click(screen.getByRole('button', { name: 'Create subscription link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have 10 calendar links.')
  })

  it('shows loading and error states for the list', async () => {
    setup()
    server.use(
      http.get('*/api/calendar-export/feeds', async () => {
        await delay(30)
        return HttpResponse.json({ code: 500, status: 'Error' }, { status: 500 })
      }),
    )
    await openSubscribe()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Couldn’t load your calendar links.')).toBeInTheDocument()
  })
})

describe('AddToCalendarDialog — accessibility and privacy copy', () => {
  it('has no axe violations on either tab and states events carry no customer details', async () => {
    const { baseElement } = setup({ feeds: [makeFeed()] })
    await screen.findByText('MOT test')
    expect(screen.getByText(/never customer details/)).toBeInTheDocument()
    await expectNoA11yViolations(baseElement)

    fireEvent.click(screen.getByRole('tab', { name: 'Subscribe (stays updated)' }))
    await screen.findByRole('list')
    await expectNoA11yViolations(baseElement)
  })
})
