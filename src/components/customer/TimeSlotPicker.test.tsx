import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/utils'
import { TimeSlotPicker } from './TimeSlotPicker'
import * as api from '../../api/publicGarage'

vi.mock('../../api/publicGarage', async (orig) => ({
  ...(await orig<typeof import('../../api/publicGarage')>()),
  getGarageDayAvailability: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

const day = {
  date: '2026-09-17',
  is_open: true,
  level: 'limited' as const,
  slots: [
    { start: '09:00', status: 'available' as const, remaining: 3, capacity: 3 },
    { start: '09:30', status: 'booked' as const, remaining: 0, capacity: 3 },
    { start: '10:00', status: 'limited' as const, remaining: 1, capacity: 3 },
  ],
}

describe('TimeSlotPicker', () => {
  it('lets you pick an available slot but not a booked one', async () => {
    vi.mocked(api.getGarageDayAvailability).mockResolvedValue(day)
    const user = userEvent.setup()
    const onSelectSlot = vi.fn()
    renderWithProviders(
      <TimeSlotPicker
        slug="g"
        date="2026-09-17"
        selectedTime={null}
        onSelectSlot={onSelectSlot}
      />,
    )

    const booked = await screen.findByRole('button', { name: '09:30 — Booked' })
    expect(booked).toHaveAttribute('aria-disabled', 'true')
    await user.click(booked)
    expect(onSelectSlot).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '09:00 — Available' }))
    expect(onSelectSlot).toHaveBeenCalledWith('09:00')
  })

  it('shows an empty message when nothing is left', async () => {
    vi.mocked(api.getGarageDayAvailability).mockResolvedValue({
      date: '2026-09-17',
      is_open: true,
      level: 'full',
      slots: [],
    })
    renderWithProviders(
      <TimeSlotPicker slug="g" date="2026-09-17" selectedTime={null} onSelectSlot={() => {}} />,
    )
    expect(
      await screen.findByText(/No times are still available/),
    ).toBeInTheDocument()
  })
})
