import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppointmentsPreview } from './AppointmentsPreview'
import { makeAppointmentItem, makeImportResult } from '../../test/fixtures'
import { expectNoA11yViolations } from '../../test/a11y'
import { renderWithProviders } from '../../test/utils'
import type { ImportResult } from '../../types'

// The calendar is the app's own TimeGridCalendar, which needs a query client
// (statuses, opening hours) - a plain render() is not enough.
const render = (ui: { props: { result: ImportResult } }) =>
  renderWithProviders(<AppointmentsPreview result={ui.props.result} />)

const result = makeImportResult(
  [
    makeAppointmentItem(0),
    makeAppointmentItem(
      1,
      {
        start: '2030-01-07T10:30:00+00:00',
        end: '2030-01-07T11:30:00+00:00',
        customer: {
          first_name: 'Alex',
          last_name: 'Kim',
          phone: null,
          email: null,
          match: 'existing',
          existing_name: 'Alex Kim',
        },
        flags: ['clash'],
      },
      { warnings: [{ path: 'appointments[1].start', message: 'Already booked then.' }] },
    ),
    makeAppointmentItem(
      2,
      { start: '2030-01-09T19:00:00+00:00', end: '2030-01-09T20:00:00+00:00' },
    ),
    makeAppointmentItem(
      3,
      { service: undefined, start: undefined, end: undefined },
      { status: 'ERROR', errors: [{ path: 'appointments[3].start', message: 'Not a time.' }] },
    ),
  ],
  { kind: 'appointments' },
)

describe('AppointmentsPreview', () => {
  it('lists every row with what it matched and what is wrong', () => {
    render(<AppointmentsPreview result={result} />)

    expect(screen.getAllByText(/^Row \d+$/)).toHaveLength(4)
    expect(screen.getByText(/^Mon,? 7 Jan 2030, 10:30–11:30$/)).toBeInTheDocument()
    expect(screen.getByText(/existing customer \(alex kim\)/i)).toBeInTheDocument()
    expect(screen.getByText('Double-booked')).toBeInTheDocument()
    expect(screen.getByText('appointments[3].start')).toBeInTheDocument()
  })

  it('narrows to problems only', async () => {
    const user = userEvent.setup()
    render(<AppointmentsPreview result={result} />)

    await user.click(screen.getByRole('checkbox', { name: /problems only/i }))

    expect(screen.getAllByText(/^Row \d+$/).map((el) => el.textContent)).toEqual(['Row 2', 'Row 4'])
  })

  it('switches between list and calendar from the keyboard', async () => {
    const user = userEvent.setup()
    render(<AppointmentsPreview result={result} />)

    const listTab = screen.getByRole('tab', { name: 'List' })
    expect(listTab).toHaveAttribute('aria-selected', 'true')
    listTab.focus()
    await user.keyboard('{ArrowRight}')

    const calendarTab = screen.getByRole('tab', { name: 'Calendar' })
    expect(calendarTab).toHaveAttribute('aria-selected', 'true')
    expect(calendarTab).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Week of Mon 7 Jan')
  })

  it('places bookings on the calendar by time and marks clashes', async () => {
    const user = userEvent.setup()
    render(<AppointmentsPreview result={result} />)
    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    const first = screen.getByRole('button', { name: /^New: 10:00 Sam Lee/ })
    const clash = screen.getByRole('button', { name: /Warning: 10:30 Alex Kim/ })
    // Overlapping bookings sit side by side rather than on top of each other.
    expect(first.style.left).toBe('0%')
    expect(clash.style.left).toBe('50%')
    expect(screen.getByRole('button', { name: /19:00 Sam Lee/ })).toBeInTheDocument()
    expect(screen.getByText(/1 row has no readable time/i)).toBeInTheDocument()
  })

  it('shows the details of a clicked booking', async () => {
    const user = userEvent.setup()
    render(<AppointmentsPreview result={result} />)
    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    await user.click(screen.getByRole('button', { name: /10:30 Alex Kim/ }))

    const details = screen.getByRole('region', { name: 'Selected appointment' })
    expect(within(details).getByText('Already booked then.')).toBeInTheDocument()
  })

  it('moves between weeks and days', async () => {
    const user = userEvent.setup()
    render(<AppointmentsPreview result={result} />)
    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    await user.click(screen.getByRole('button', { name: 'Day' }))
    expect(screen.getByRole('status')).toHaveTextContent('Mon 7 Jan')
    await user.click(screen.getByRole('button', { name: /next day/i }))
    expect(screen.getByRole('status')).toHaveTextContent('Tue 8 Jan')

    await user.selectOptions(screen.getByLabelText(/jump to a day/i), '2030-01-09')
    expect(screen.getByRole('status')).toHaveTextContent('Wed 9 Jan')
  })

  it('has no axe violations in either view', async () => {
    const user = userEvent.setup()
    const { container } = render(<AppointmentsPreview result={result} />)
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('tab', { name: 'Calendar' }))
    await expectNoA11yViolations(container)
  })
})
