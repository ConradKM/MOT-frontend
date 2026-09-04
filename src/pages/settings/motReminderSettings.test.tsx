import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { MotReminderSettings } from './MotReminderSettings'
import * as motRemindersApi from '../../api/motReminders'

vi.mock('../../api/motReminders')

const SETTINGS = {
  id: 's1',
  stage1_enabled: true, stage1_days_before: 30,
  stage2_enabled: true, stage2_days_before: 7,
  stage3_enabled: true, stage3_days_before: 1,
}

function render() {
  vi.mocked(motRemindersApi.getMOTReminderSettings).mockResolvedValue({ ...SETTINGS })
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route
          path="/:garageId/settings/mot-reminders"
          element={<MotReminderSettings />}
        />
      </Routes>
    </ToastProvider>,
    { route: '/g/settings/mot-reminders' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('MotReminderSettings', () => {
  it('shows the current schedule', async () => {
    render()
    expect(await screen.findByLabelText('First reminder days before expiry')).toHaveValue(30)
    expect(screen.getByLabelText('Second reminder days before expiry')).toHaveValue(7)
    expect(screen.getByLabelText('Final reminder days before expiry')).toHaveValue(1)
  })

  it('rejects duplicate enabled intervals without calling the API', async () => {
    const user = userEvent.setup()
    render()

    const second = await screen.findByLabelText('Second reminder days before expiry')
    await user.clear(second)
    await user.type(second, '30')
    await user.click(screen.getByRole('button', { name: /save reminder settings/i }))

    expect(screen.getByText(/different intervals/i)).toBeInTheDocument()
    expect(motRemindersApi.updateMOTReminderSettings).not.toHaveBeenCalled()
  })

  it('saves a valid change', async () => {
    vi.mocked(motRemindersApi.updateMOTReminderSettings).mockResolvedValue({
      ...SETTINGS, stage2_days_before: 14,
    })
    const user = userEvent.setup()
    render()

    const second = await screen.findByLabelText('Second reminder days before expiry')
    await user.clear(second)
    await user.type(second, '14')
    await user.click(screen.getByRole('button', { name: /save reminder settings/i }))

    expect(motRemindersApi.updateMOTReminderSettings).toHaveBeenCalled()
    expect(
      vi.mocked(motRemindersApi.updateMOTReminderSettings).mock.calls[0][0],
    ).toMatchObject({ stage2_days_before: 14, stage1_days_before: 30, stage3_days_before: 1 })
  })

  it('disables the interval input when a stage is turned off', async () => {
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByLabelText('Final reminder'))
    expect(screen.getByLabelText('Final reminder days before expiry')).toBeDisabled()
  })
})
