import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/utils'
import { ToastProvider } from '../../components/Toast'
import { WhatsAppInbox } from './WhatsAppInbox'
import { ApiError } from '../../api/client'
import * as communicationsApi from '../../api/communications'
import * as customersApi from '../../api/customers'
import { makeCustomer } from '../../test/fixtures'

// + New message, the conversation-actions menu, archive/restore, owner-only
// delete, and "never show a rejected send as Sent".

vi.mock('../../api/communications')
vi.mock('../../api/customers')

const PHONE = '+447123456789'

function makeLog(patch: Partial<communicationsApi.CommunicationLog> = {}): communicationsApi.CommunicationLog {
  return {
    id: 'm1', channel: 'WHATSAPP', direction: 'INBOUND', external_provider: 'x',
    external_id: null, from_address: `whatsapp:${PHONE}`, to_address: null, status: 'received',
    trigger_event: null, body: 'Hello there', call_duration_seconds: null, error_code: null,
    error_message: null, read_at: null, created_at: '2026-09-05T19:25:00+00:00',
    updated_at: '2026-09-05T19:25:00+00:00', customer: null, appointment: null, booking_request: null,
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
    calls_today: 0, missed_calls_today: 0, whatsapp_unread: 0, outgoing_contacts_today: 0,
    recent: [],
    capabilities: {
      communications_enabled: true, voice_number_configured: true,
      whatsapp_configured: true, outbound_calling_supported: true,
    },
  })
  vi.mocked(communicationsApi.listConversations).mockResolvedValue({
    items: conversations, total: conversations.length,
  })
  vi.mocked(communicationsApi.getConversationMessages).mockResolvedValue({
    phone: PHONE, customer: null, messages: [CONVERSATION.last_message],
  })
  vi.mocked(communicationsApi.getConversationAutomationStatus).mockResolvedValue({
    phone: PHONE, status: null, intent: null, handoff_reason: null,
  })
  vi.mocked(customersApi.listCustomers).mockResolvedValue([])
}

function render(route = '/g/communications/whatsapp') {
  return renderWithProviders(
    <ToastProvider>
      <Routes>
        <Route path="/:garageId/communications/whatsapp" element={<WhatsAppInbox />} />
      </Routes>
    </ToastProvider>,
    { route },
  )
}

beforeEach(() => {
  vi.mocked(communicationsApi.markConversationRead).mockResolvedValue({ updated: 0 })
})
afterEach(() => vi.clearAllMocks())

describe('WhatsAppInbox - new message', () => {
  it('starts a conversation with a searched-for customer', async () => {
    mockCommon([])
    const cust = makeCustomer({ id: 'c9', first_name: 'Priya', last_name: 'Shah', phone: '07999888777' })
    vi.mocked(customersApi.listCustomers).mockResolvedValue([cust])
    vi.mocked(communicationsApi.sendWhatsAppMessage).mockResolvedValue(
      makeLog({ id: 's1', direction: 'OUTBOUND', status: 'queued', to_address: 'whatsapp:+447999888777' }),
    )
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /new message/i }))
    const dialog = screen.getByRole('heading', { name: 'New message' }).closest('div')!.parentElement!
    await user.type(within(dialog).getByPlaceholderText(/search customers/i), 'Priya')
    await user.click(await screen.findByText('Priya Shah'))
    await user.type(within(dialog).getByPlaceholderText('Message…'), 'Your car is ready')
    await user.click(within(dialog).getByRole('button', { name: /^send$/i }))

    await waitFor(() =>
      expect(communicationsApi.sendWhatsAppMessage).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: 'c9', body: 'Your car is ready' }),
      ),
    )
  })

  it('starts a conversation with a manually typed number', async () => {
    mockCommon([])
    vi.mocked(communicationsApi.sendWhatsAppMessage).mockResolvedValue(
      makeLog({ id: 's2', direction: 'OUTBOUND', status: 'sent', to_address: 'whatsapp:+447555111222' }),
    )
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /new message/i }))
    await user.click(screen.getByRole('button', { name: /new number/i }))
    await user.type(screen.getByPlaceholderText('07123 456789'), '07555111222')
    await user.type(screen.getByPlaceholderText('Message…'), 'Hi from the garage')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() =>
      expect(communicationsApi.sendWhatsAppMessage).toHaveBeenCalledWith(
        expect.objectContaining({ to: '07555111222', body: 'Hi from the garage' }),
      ),
    )
  })

  it('opens the existing thread instead of creating a duplicate', async () => {
    mockCommon([{ ...CONVERSATION, customer: makeCustomer({ id: 'c1', phone: '07123456789' }) }])
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /new message/i }))
    await user.click(screen.getByRole('button', { name: /new number/i }))
    // Same E.164 as the existing conversation's `phone`.
    await user.type(screen.getByPlaceholderText('07123 456789'), PHONE)
    await user.type(screen.getByPlaceholderText('Message…'), 'anything')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'New message' })).not.toBeInTheDocument(),
    )
    expect(communicationsApi.sendWhatsAppMessage).not.toHaveBeenCalled()
  })

  it('shows a real rejection instead of reporting the message as sent', async () => {
    mockCommon([])
    vi.mocked(communicationsApi.sendWhatsAppMessage).mockResolvedValue(
      makeLog({
        id: 's3', direction: 'OUTBOUND', status: 'FAILED', to_address: 'whatsapp:+447555111222',
        error_message: 'Outside the 24-hour customer service window.',
      }),
    )
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: /new message/i }))
    await user.click(screen.getByRole('button', { name: /new number/i }))
    await user.type(screen.getByPlaceholderText('07123 456789'), '07555111222')
    await user.type(screen.getByPlaceholderText('Message…'), 'late reply')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(await screen.findByText(/24-hour customer service window/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'New message' })).toBeInTheDocument()
  })
})

describe('WhatsAppInbox - conversation actions', () => {
  it('archives a conversation', async () => {
    mockCommon()
    vi.mocked(communicationsApi.archiveConversation).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(`/g/communications/whatsapp?phone=${encodeURIComponent(PHONE)}`)

    await user.click(await screen.findByRole('button', { name: /conversation actions/i }))
    await user.click(await screen.findByRole('button', { name: /^archive$/i }))

    await waitFor(() => expect(communicationsApi.archiveConversation).toHaveBeenCalled())
    expect(vi.mocked(communicationsApi.archiveConversation).mock.calls[0][0]).toBe(PHONE)
  })

  it('restores an archived conversation', async () => {
    mockCommon([{ ...CONVERSATION, archived: true }])
    vi.mocked(communicationsApi.restoreConversation).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(`/g/communications/whatsapp?phone=${encodeURIComponent(PHONE)}`)

    await user.click(await screen.findByRole('button', { name: /conversation actions/i }))
    await user.click(await screen.findByRole('button', { name: /^restore$/i }))

    await waitFor(() => expect(communicationsApi.restoreConversation).toHaveBeenCalled())
    expect(vi.mocked(communicationsApi.restoreConversation).mock.calls[0][0]).toBe(PHONE)
  })

  it('surfaces a 403 when a non-owner tries to delete', async () => {
    mockCommon()
    vi.mocked(communicationsApi.deleteConversation).mockRejectedValue(
      new ApiError({ code: 403, status: 'Forbidden', message: 'Owner only.' }, 'Forbidden'),
    )
    const user = userEvent.setup()
    render(`/g/communications/whatsapp?phone=${encodeURIComponent(PHONE)}`)

    await user.click(await screen.findByRole('button', { name: /conversation actions/i }))
    await user.click(await screen.findByRole('button', { name: /delete/i }))
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    expect(
      await screen.findByText(/only the business owner can delete a conversation/i),
    ).toBeInTheDocument()
    expect(vi.mocked(communicationsApi.deleteConversation).mock.calls[0][0]).toBe(PHONE)
  })
})

describe('WhatsAppInbox - filters', () => {
  it('requests the archived list when the Archived tab is chosen', async () => {
    mockCommon()
    const user = userEvent.setup()
    render()

    await user.click(await screen.findByRole('button', { name: 'Archived' }))

    await waitFor(() =>
      expect(communicationsApi.listConversations).toHaveBeenCalledWith(
        expect.objectContaining({ filter: 'archived' }),
      ),
    )
  })
})
