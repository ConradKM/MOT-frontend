import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { WhatsAppInbox } from './WhatsAppInbox'
import * as communicationsApi from '../../api/communications'

// "Take over conversation" / "Resume automation" - the one control deciding
// whether the bot or a human currently owns a WhatsApp conversation.

vi.mock('../../api/communications')

const PHONE = '+447123456789'

const CONVERSATION: communicationsApi.Conversation = {
  phone: PHONE,
  customer: null,
  unread_count: 0,
  last_message: {
    id: 'm1', channel: 'WHATSAPP', direction: 'INBOUND', external_provider: 'comaz_conversation_engine',
    external_id: null, from_address: `whatsapp:${PHONE}`, to_address: null, status: 'received',
    trigger_event: null, body: 'I need an MOT', call_duration_seconds: null, error_code: null,
    error_message: null, read_at: null, created_at: '2026-09-05T19:25:00+00:00',
    updated_at: '2026-09-05T19:25:00+00:00', customer: null, appointment: null, booking_request: null,
  },
}

function mockCommonQueries() {
  vi.mocked(communicationsApi.getOverview).mockResolvedValue({
    calls_today: 0, missed_calls_today: 0, whatsapp_unread: 0, outgoing_contacts_today: 0,
    recent: [],
    capabilities: {
      communications_enabled: true, voice_number_configured: true,
      whatsapp_configured: true, outbound_calling_supported: false,
    },
  })
  vi.mocked(communicationsApi.listConversations).mockResolvedValue({ items: [CONVERSATION], total: 1 })
  vi.mocked(communicationsApi.getConversationMessages).mockResolvedValue({
    phone: PHONE, customer: null, messages: [CONVERSATION.last_message],
  })
}

function render() {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/communications/whatsapp" element={<WhatsAppInbox />} />
      </Routes>
    </ToastProvider>,
    { route: `/g/communications/whatsapp?phone=${encodeURIComponent(PHONE)}` },
  )
}

afterEach(() => vi.clearAllMocks())

describe('WhatsAppInbox - conversation automation control', () => {
  it('shows nothing when there is no automated session for this number', async () => {
    mockCommonQueries()
    vi.mocked(communicationsApi.getConversationAutomationStatus).mockResolvedValue({
      phone: PHONE, status: null, intent: null, handoff_reason: null,
    })
    render()

    // "I need an MOT" appears twice (the conversation-list preview and the
    // thread bubble) - findAllByText just waits for the thread to load.
    await screen.findAllByText('I need an MOT')
    expect(screen.queryByText(/take over/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/resume assistant/i)).not.toBeInTheDocument()
  })

  it('offers to take over an active automated conversation', async () => {
    mockCommonQueries()
    vi.mocked(communicationsApi.getConversationAutomationStatus).mockResolvedValue({
      phone: PHONE, status: 'ACTIVE', intent: 'CREATE_BOOKING', handoff_reason: null,
    })
    vi.mocked(communicationsApi.takeoverConversation).mockResolvedValue({
      phone: PHONE, status: 'HUMAN_HANDOFF', intent: 'CREATE_BOOKING', handoff_reason: 'Taken over by Test User.',
    })
    const user = userEvent.setup()
    render()

    expect(await screen.findByText(/assistant is replying/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /take over/i }))

    await waitFor(() => expect(communicationsApi.takeoverConversation).toHaveBeenCalledWith(PHONE))
  })

  it('offers to resume automation on a conversation handed to a human', async () => {
    mockCommonQueries()
    vi.mocked(communicationsApi.getConversationAutomationStatus).mockResolvedValue({
      phone: PHONE, status: 'HUMAN_HANDOFF', intent: 'SPEAK_TO_HUMAN', handoff_reason: 'Customer asked for a person.',
    })
    vi.mocked(communicationsApi.resumeConversationAutomation).mockResolvedValue({
      phone: PHONE, status: 'ACTIVE', intent: null, handoff_reason: null,
    })
    const user = userEvent.setup()
    render()

    expect(await screen.findByText(/needs a reply/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /resume assistant/i }))

    await waitFor(() => expect(communicationsApi.resumeConversationAutomation).toHaveBeenCalledWith(PHONE))
  })
})
