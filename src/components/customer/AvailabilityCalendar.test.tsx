import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/utils'
import { AvailabilityCalendar } from './AvailabilityCalendar'
import * as api from '../../api/publicGarage'

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getGarageAvailability: vi.fn(),
}))

const TODAY = '2026-09-10'

function range() {
  return {
    garage: { slug: 'g', name: 'Test Garage' },
    rules: {
      slot_interval_minutes: 30,
      min_lead_time_hours: 24,
      max_advance_days: 60,
      booking_window_start: TODAY,
      booking_window_end: '2026-11-09',
    },
    opening_hours: [],
    days: [
      { date: '2026-09-10', weekday: 3, is_open: true, level: 'available' as const, open_slots: 8, total_slots: 10 },
      { date: '2026-09-11', weekday: 4, is_open: true, level: 'full' as const, open_slots: 0, total_slots: 10 },
      { date: '2026-09-12', weekday: 5, is_open: false, level: 'closed' as const, open_slots: 0, total_slots: 0 },
    ],
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 10, 9, 0, 0))
  vi.mocked(api.getGarageAvailability).mockResolvedValue(range())
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('AvailabilityCalendar', () => {
  it('shows a text legend, not colour alone', async () => {
    renderWithProviders(
      <AvailabilityCalendar slug="g" selectedDate={null} onSelectDate={() => {}} />,
    )
    expect(await screen.findByText(/September 2026/)).toBeInTheDocument()
    // Legend spells the levels out in words.
    expect(screen.getByText('Fully booked')).toBeInTheDocument()
    expect(screen.getByText('Good availability')).toBeInTheDocument()
    // Day cells carry their own text indicator, not just a colour.
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getAllByText('Closed').length).toBeGreaterThan(0)
  })

  it('selects an available day and refuses a full one', async () => {
    const user = userEvent.setup()
    const onSelectDate = vi.fn()
    renderWithProviders(
      <AvailabilityCalendar slug="g" selectedDate={null} onSelectDate={onSelectDate} />,
    )

    const available = await screen.findByRole('gridcell', {
      name: /10 September 2026 — Good availability, selectable/,
    })
    await user.click(available)
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-10')

    const full = screen.getByRole('gridcell', {
      name: /11 September 2026 — Fully booked/,
    })
    expect(full).toHaveAttribute('aria-disabled', 'true')
    await user.click(full)
    expect(onSelectDate).toHaveBeenCalledTimes(1)
  })

  it('clamps the previous-month button at the window start', async () => {
    renderWithProviders(
      <AvailabilityCalendar slug="g" selectedDate={null} onSelectDate={() => {}} />,
    )
    await screen.findByText(/September 2026/)
    expect(screen.getByLabelText('Previous month')).toBeDisabled()
    await waitFor(() =>
      expect(screen.getByLabelText('Next month')).not.toBeDisabled(),
    )
  })
})
