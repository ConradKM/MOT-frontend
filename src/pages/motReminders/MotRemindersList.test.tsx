import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { MotRemindersList } from './MotRemindersList'
import * as motRemindersApi from '../../api/motReminders'
import * as garageApi from '../../api/garage'
import type { MOTReminderRow } from '../../api/motReminders'

vi.mock('../../api/motReminders')
vi.mock('../../api/garage')

const BASE_ROW: MOTReminderRow = {
  vehicle_id: 'v1',
  customer_id: 'c1',
  customer_name: 'Oliver Bennett',
  customer_email: 'oliver@example.com',
  registration_number: 'OB08AUD',
  make: 'Audi',
  model: 'A4',
  mot_expiry_date: '2026-10-01',
  reminder_status: 'scheduled',
  booking_active: false,
  last_reminder_sent: null,
  next_reminder_scheduled: '2026-09-01',
  can_send_manual: true,
  stages: [
    { stage: 'STAGE_1', days_before: 30, enabled: true, state: 'scheduled', sent_at: null, scheduled_for: '2026-09-01' },
    { stage: 'STAGE_2', days_before: 7, enabled: true, state: 'scheduled', sent_at: null, scheduled_for: '2026-09-24' },
    { stage: 'STAGE_3', days_before: 1, enabled: true, state: 'scheduled', sent_at: null, scheduled_for: '2026-09-30' },
  ],
  history: [],
}

function render(rows: MOTReminderRow[]) {
  vi.mocked(garageApi.getGarage).mockResolvedValue({
    id: 'g', name: 'Kingsway', slug: 'kingsway-x', layout_variant: null,
    email: null, phone: null, address: null, postcode: null, website: null,
    created_at: '', updated_at: '',
  })
  vi.mocked(motRemindersApi.listMOTReminders).mockResolvedValue(rows)
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/mot-reminders" element={<MotRemindersList />} />
      </Routes>
    </ToastProvider>,
    { route: '/g/mot-reminders' },
  )
}

afterEach(() => vi.clearAllMocks())

describe('MotRemindersList', () => {
  it('offers a manual "Send reminder" and confirms before sending', async () => {
    vi.mocked(motRemindersApi.sendManualReminder).mockResolvedValue({
      stage: 'MANUAL', trigger: 'MANUAL', channel: 'email', status: 'SENT',
      sent_at: '2026-09-04T10:00:00Z', detail: 'Emailed oliver@example.com.',
    })
    const user = userEvent.setup()
    render([BASE_ROW])

    await user.click(await screen.findByRole('button', { name: 'Send reminder' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/Send another MOT reminder to/i),
    ).toHaveTextContent('Oliver Bennett')
    expect(within(dialog).getByText(/OB08AUD/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Send reminder' }))
    expect(motRemindersApi.sendManualReminder).toHaveBeenCalledWith('v1', {
      acknowledge_booking: false,
    })
  })

  it('replaces the action and clears Next scheduled when a booking exists', async () => {
    render([
      {
        ...BASE_ROW,
        reminder_status: 'booked',
        booking_active: true,
        next_reminder_scheduled: null,
      },
    ])

    const row = (await screen.findByText('OB08AUD')).closest('tr')!
    // status badge + "next scheduled" cell + the action pill all say it.
    expect(within(row).getAllByText('MOT booked').length).toBeGreaterThanOrEqual(2)
    expect(within(row).queryByRole('button', { name: 'Send reminder' })).toBeNull()
    // "Send anyway" is still available for the exceptional case.
    expect(within(row).getByRole('button', { name: /send anyway/i })).toBeInTheDocument()
  })

  it('expands a row to show the per-stage schedule and history', async () => {
    const user = userEvent.setup()
    render([
      {
        ...BASE_ROW,
        last_reminder_sent: '2026-09-01T09:00:00Z',
        stages: [
          { stage: 'STAGE_1', days_before: 30, enabled: true, state: 'sent', sent_at: '2026-09-01T09:00:00Z', scheduled_for: null },
          { stage: 'STAGE_2', days_before: 7, enabled: false, state: 'disabled', sent_at: null, scheduled_for: null },
          { stage: 'STAGE_3', days_before: 1, enabled: true, state: 'scheduled', sent_at: null, scheduled_for: '2026-09-30' },
        ],
        history: [
          { stage: 'STAGE_1', trigger: 'AUTOMATIC', channel: 'email', status: 'SENT', sent_at: '2026-09-01T09:00:00Z', scheduled_at: '2026-09-01T09:00:00Z', detail: null, initiated_by: null },
          { stage: 'MANUAL', trigger: 'MANUAL', channel: 'email', status: 'SENT', sent_at: '2026-09-03T14:00:00Z', scheduled_at: '2026-09-03T14:00:00Z', detail: null, initiated_by: 'Sarah' },
        ],
      },
    ])

    await user.click(await screen.findByRole('button', { name: /show reminder history/i }))

    expect(screen.getByText(/First reminder — 30 days before/)).toBeInTheDocument()
    expect(screen.getByText(/Second reminder — 7 days before/)).toBeInTheDocument()
    expect(screen.getByText(/by Sarah/)).toBeInTheDocument()
  })
})
