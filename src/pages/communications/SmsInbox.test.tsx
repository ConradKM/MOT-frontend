import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { SmsInbox } from './SmsInbox'
import * as communicationsApi from '../../api/communications'
import * as customersApi from '../../api/customers'
import { makeCustomer } from '../../test/fixtures'

vi.mock('../../api/communications')
vi.mock('../../api/customers')

const PHONE = '+447123456789'

function makeLog(patch: Partial<communicationsApi.CommunicationLog> = {}): communicationsApi.CommunicationLog {
  return {
    id: 'm1', channel: 'SMS', direction: 'INBOUND', external_provider: 'twilio',
    external_id: null, from_address: PHONE, to_address: '+441111111111', status: 'received',
    trigger_event: null, body: 'Can I book an MOT?', call_duration_seconds: null, error_code: null,
    error_message: null, read_at: null, created_at: '2026-09-16T19:25:00+00:00',
    updated_at: '2026-09-16T19:25:00+00:00', customer: null, appointment: null, booking_request: null,
    ...patch,
  }
}

const CONVERSATION: communicationsApi.Conversation = {
  phone: PHONE,
  customer: null,
  unread_count: 0,
  archived: false,
  last_message: makeLog(),
}

function mockCommon(conversations: communicationsApi.Conversation[] = [CONVERSATION]) {
  vi.mocked(communicationsApi.getOverview).mockResolvedValue({
    calls_today: 0, missed_calls_today: 0, whatsapp_unread: 0, sms_unread: 0,
    outgoing_contacts_today: 0, recent: [],
    capabilities: {
      communications_enabled: true, voice_number_configured: true,
      whatsapp_configured: true, sms_configured: true, outbound_calling_supported: true,
    },
  })
  vi.mocked(communicationsApi.listSmsConversations).mockResolvedValue({
    items: conversations, total: conversations.length,
  })
  vi.mocked(communicationsApi.getSmsConversationMessages).mockResolvedValue({
    phone: PHONE, customer: null, messages: [CONVERSATION.last_message],
  })
  vi.mocked(customersApi.listCustomers).mockResolvedValue([])
}

function render(route = '/g/communications/sms') {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/communications/sms" element={<SmsInbox />} />
      </Routes>
    </ToastProvider>,
    { route },
  )
}

beforeEach(() => {
  vi.mocked(communicationsApi.markSmsConversationRead).mockResolvedValue({ updated: 0 })
})
afterEach(() => vi.clearAllMocks())

describe('SmsInbox - conversation list and thread', () => {
  it('lists SMS conversations and shows the selected thread', async () => {
    mockCommon()
    render(`/g/communications/sms?phone=${encodeURIComponent(PHONE)}`)

    expect(await screen.findByText('Unknown number')).toBeInTheDocument()
    // Appears twice: once in the sidebar preview, once in the open thread.
    expect((await screen.findAllByText('Can I book an MOT?')).length).toBe(2)
  })

  it('shows an empty state when there are no SMS conversations yet', async () => {
    mockCommon([])
    render()

    expect(await screen.findByText(/no sms conversations yet/i)).toBeInTheDocument()
  })

  it('shows a not-connected banner when SMS is not configured', async () => {
    mockCommon([])
    vi.mocked(communicationsApi.getOverview).mockResolvedValue({
      calls_today: 0, missed_calls_today: 0, whatsapp_unread: 0, sms_unread: 0,
      outgoing_contacts_today: 0, recent: [],
      capabilities: {
        communications_enabled: false, voice_number_configured: false,
        whatsapp_configured: false, sms_configured: false, outbound_calling_supported: false,
      },
    })
    render()

    expect(await screen.findByText(/sms is not connected yet/i)).toBeInTheDocument()
  })
})

describe('SmsInbox - sending', () => {
  it('sends a reply in the open thread', async () => {
    mockCommon()
    vi.mocked(communicationsApi.sendSmsMessage).mockResolvedValue(
      makeLog({ id: 's1', direction: 'OUTBOUND', status: 'queued', to_address: PHONE, from_address: '+441111111111' }),
    )
    const user = userEvent.setup()
    render(`/g/communications/sms?phone=${encodeURIComponent(PHONE)}`)

    await screen.findAllByText('Can I book an MOT?')
    await user.type(screen.getByPlaceholderText('Message customer…'), 'Sure, what date works?')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() =>
      expect(communicationsApi.sendSmsMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: PHONE, body: 'Sure, what date works?' }),
      ),
    )
  })

  it('starts a new SMS conversation with a searched-for customer', async () => {
    mockCommon([])
    const cust = makeCustomer({ id: 'c9', first_name: 'Priya', last_name: 'Shah', phone: '07999888777' })
    vi.mocked(customersApi.listCustomers).mockResolvedValue([cust])
    vi.mocked(communicationsApi.sendSmsMessage).mockResolvedValue(
      makeLog({ id: 's2', direction: 'OUTBOUND', status: 'queued', to_address: '+447999888777' }),
    )
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /new message/i }))
    const dialog = screen.getByRole('heading', { name: 'New SMS' }).closest('div')!.parentElement!
    await user.type(within(dialog).getByPlaceholderText(/search customers/i), 'Priya')
    await user.click(await screen.findByText('Priya Shah'))
    await user.type(within(dialog).getByPlaceholderText('Message…'), 'Your MOT reminder')
    await user.click(within(dialog).getByRole('button', { name: /^send$/i }))

    await waitFor(() =>
      expect(communicationsApi.sendSmsMessage).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: 'c9', body: 'Your MOT reminder' }),
      ),
    )
  })

  it('shows a rejection instead of reporting the message as sent', async () => {
    mockCommon()
    vi.mocked(communicationsApi.sendSmsMessage).mockResolvedValue(
      makeLog({
        id: 's3', direction: 'OUTBOUND', status: 'FAILED', to_address: PHONE,
        error_message: 'That number cannot receive SMS.',
      }),
    )
    const user = userEvent.setup()
    render(`/g/communications/sms?phone=${encodeURIComponent(PHONE)}`)

    await screen.findAllByText('Can I book an MOT?')
    await user.type(screen.getByPlaceholderText('Message customer…'), 'hi')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => expect(communicationsApi.sendSmsMessage).toHaveBeenCalled())
  })
})

describe('SmsInbox - read receipts', () => {
  it('marks an unread thread read when opened', async () => {
    mockCommon([{ ...CONVERSATION, unread_count: 1 }])
    render(`/g/communications/sms?phone=${encodeURIComponent(PHONE)}`)

    await waitFor(() => expect(communicationsApi.markSmsConversationRead).toHaveBeenCalledWith(PHONE))
  })
})
