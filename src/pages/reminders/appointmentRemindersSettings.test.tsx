import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { AppointmentRemindersSettings } from './AppointmentRemindersSettings'
import * as appointmentRemindersApi from '../../api/appointmentReminders'

vi.mock('../../api/appointmentReminders')

const SETTINGS = {
  id: 's1',
  enabled: false,
  channels: ['email'] as const,
  available_channels: ['email'] as const,
  timings: [
    { id: 't1', hours_before: 24, enabled: true },
    { id: 't2', hours_before: 2, enabled: true },
  ],
}

function render() {
  vi.mocked(appointmentRemindersApi.getAppointmentReminderSettings).mockResolvedValue({
    ...SETTINGS,
    channels: [...SETTINGS.channels],
    available_channels: [...SETTINGS.available_channels],
    timings: SETTINGS.timings.map((t) => ({ ...t })),
  })
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/reminders" element={<AppointmentRemindersSettings />} />
      </Routes>
    </ToastProvider>,
    { route: '/g/reminders' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('AppointmentRemindersSettings', () => {
  it('shows the current timings', async () => {
    render()
    expect(await screen.findByLabelText('Timing 1 hours before')).toHaveValue(24)
    expect(screen.getByLabelText('Timing 2 hours before')).toHaveValue(2)
  })

  it('never offers a channel the business is not configured for', async () => {
    render()
    await screen.findByLabelText('Timing 1 hours before')
    expect(screen.getByText('SMS').closest('label')).toHaveClass('bg-slate-50')
    expect(screen.getByRole('checkbox', { name: 'SMS' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Email' })).not.toBeDisabled()
  })

  it('adds a timing and saves the enabled settings', async () => {
    vi.mocked(appointmentRemindersApi.updateAppointmentReminderSettings).mockResolvedValue({
      ...SETTINGS,
      enabled: true,
    })
    const user = userEvent.setup()
    render()

    await user.click(
      await screen.findByLabelText('Send automatic appointment reminders'),
    )
    await user.click(screen.getByRole('button', { name: /add another timing/i }))
    await user.click(screen.getByRole('button', { name: /save reminder settings/i }))

    const call = vi.mocked(appointmentRemindersApi.updateAppointmentReminderSettings).mock
      .calls[0][0]
    expect(call.enabled).toBe(true)
    expect(call.timings).toEqual([
      { hours_before: 24, enabled: true },
      { hours_before: 2, enabled: true },
      { hours_before: 24, enabled: true },
    ])
  })

  it('removes a timing', async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByLabelText('Remove timing 2'))

    expect(screen.queryByLabelText('Timing 2 hours before')).not.toBeInTheDocument()
  })
})
