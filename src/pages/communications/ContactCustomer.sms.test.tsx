import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { ContactCustomer } from './ContactCustomer'
import * as communicationsApi from '../../api/communications'

vi.mock('../../api/communications')

function makeLog(patch: Partial<communicationsApi.CommunicationLog> = {}): communicationsApi.CommunicationLog {
  return {
    id: 's1', channel: 'SMS', direction: 'OUTBOUND', external_provider: 'twilio',
    external_id: null, from_address: '+441111111111', to_address: '+447123456789', status: 'queued',
    trigger_event: null, body: 'hi', call_duration_seconds: null, error_code: null,
    error_message: null, read_at: null, created_at: '2026-09-16T19:25:00+00:00',
    updated_at: '2026-09-16T19:25:00+00:00', customer: null, appointment: null, booking_request: null,
    ...patch,
  }
}

beforeEach(() => {
  vi.mocked(communicationsApi.getOverview).mockResolvedValue({
    calls_today: 0, missed_calls_today: 0, whatsapp_unread: 0, sms_unread: 0,
    outgoing_contacts_today: 0, recent: [],
    capabilities: {
      communications_enabled: true, voice_number_configured: true,
      whatsapp_configured: true, sms_configured: true, outbound_calling_supported: false,
    },
  })
})
afterEach(() => vi.clearAllMocks())

function render(route: string) {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/communications/contact" element={<ContactCustomer />} />
      </Routes>
    </ToastProvider>,
    { route },
  )
}

describe('ContactCustomer - SMS tab', () => {
  it('sends an SMS to a raw phone number', async () => {
    vi.mocked(communicationsApi.sendSmsMessage).mockResolvedValue(makeLog())
    const user = userEvent.setup()
    render('/g1/communications/contact?phone=07123456789&tab=sms')

    await user.type(screen.getByLabelText('Message customer…'), 'Your MOT is booked.')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() =>
      expect(communicationsApi.sendSmsMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: '07123456789', body: 'Your MOT is booked.' }),
      ),
    )
    expect(await screen.findByText(/message recorded/i)).toBeInTheDocument()
  })

  it('shows a not-connected warning when SMS is not configured', async () => {
    vi.mocked(communicationsApi.getOverview).mockResolvedValue({
      calls_today: 0, missed_calls_today: 0, whatsapp_unread: 0, sms_unread: 0,
      outgoing_contacts_today: 0, recent: [],
      capabilities: {
        communications_enabled: false, voice_number_configured: false,
        whatsapp_configured: false, sms_configured: false, outbound_calling_supported: false,
      },
    })
    render('/g1/communications/contact?phone=07123456789&tab=sms')

    expect(await screen.findByText(/sms is not connected yet/i)).toBeInTheDocument()
  })
})
