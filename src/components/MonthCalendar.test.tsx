import type { ComponentProps } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MonthCalendar } from './MonthCalendar'
import { makeAppointment } from '../test/fixtures'
import { monthGridDatesIso } from '../lib/datetime'

function renderCalendar(overrides: Partial<ComponentProps<typeof MonthCalendar>> = {}) {
  const onSelectDay = vi.fn()
  render(
    <MemoryRouter initialEntries={['/g1/appointments']}>
      <Routes>
        <Route path="/:garageId/appointments" element={<MonthCalendar dates={monthGridDatesIso('2026-09-15')} month="2026-09-15" today="2026-09-14" appointments={[]} customerName={(id) => (id === 'c1' ? 'Oliver Bennett' : 'Ava Jones')} appointmentTypeName={() => 'MOT test'} onSelectDay={onSelectDay} {...overrides} />} />
      </Routes>
    </MemoryRouter>,
  )
  return { onSelectDay }
}

describe('MonthCalendar', () => {
  it('renders a Monday-to-Sunday grid with leading/trailing days and today', () => {
    renderCalendar()
    expect(screen.getAllByText('Mon')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'View Monday, 31 August 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Sunday, 4 October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Monday, 14 September 2026' })).toHaveClass('bg-slate-900')
  })

  it('shows appointments on their local calendar date and opens the existing overview', () => {
    renderCalendar({ appointments: [makeAppointment({ id: 'a-sep', start_time: '2026-09-14T09:00:00+01:00' }), makeAppointment({ id: 'a-oct', customer_id: 'c2', start_time: '2026-10-01T11:00:00+01:00' })] })
    expect(screen.getByRole('link', { name: /09:00 Oliver Bennett/ })).toHaveAttribute('href', '/g1/appointments/a-sep/overview')
    expect(screen.getByRole('link', { name: /11:00 Ava Jones/ })).toHaveAttribute('href', '/g1/appointments/a-oct/overview')
  })

  it('keeps an empty month readable and sends selected days to the detailed Day view', () => {
    const { onSelectDay } = renderCalendar()
    fireEvent.click(screen.getByRole('button', { name: 'View Tuesday, 15 September 2026' }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-09-15')
  })

  it('limits a busy day and sends users to Day view for the remaining appointments', () => {
    const { onSelectDay } = renderCalendar({ appointments: Array.from({ length: 4 }, (_, index) => makeAppointment({ id: `a-${index}`, start_time: `2026-09-14T09:${String(index * 10).padStart(2, '0')}:00+01:00` })) })
    expect(screen.getByRole('button', { name: '+1 more' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+1 more' }))
    expect(onSelectDay).toHaveBeenCalledWith('2026-09-14')
  })
})
