import { apiFetch } from './client'

export type CommChannel = 'VOICE' | 'WHATSAPP' | 'SMS' | 'EMAIL'
// SYSTEM is a real runtime value for conversation-engine "action" rows (e.g.
// "Booking request created") that appear in a call transcript alongside the
// INBOUND/OUTBOUND turns.
export type CommDirection = 'INBOUND' | 'OUTBOUND' | 'SYSTEM'

export interface CommunicationCustomer {
  id: string
  first_name: string
  last_name: string
  phone: string | null
}

export interface CommunicationAppointmentRef {
  id: string
  start_time: string
  status: string
}

export interface CommunicationBookingRequestRef {
  id: string
  status: string
}

export interface CommunicationLog {
  id: string
  channel: CommChannel
  direction: CommDirection
  external_provider: string
  external_id: string | null
  /** The Twilio CallSid this row belongs to (voice only). The one call-level
   * row and all of its transcript turns share it. */
  call_sid?: string | null
  from_address: string | null
  to_address: string | null
  status: string
  trigger_event: string | null
  body: string | null
  call_duration_seconds: number | null
  error_code: string | null
  error_message: string | null
  read_at: string | null
  created_at: string
  updated_at: string
  customer: CommunicationCustomer | null
  appointment: CommunicationAppointmentRef | null
  booking_request: CommunicationBookingRequestRef | null
}

/** A single call plus its conversation transcript - the caller/assistant
 * turns and system events exchanged during it, oldest first. Empty for a
 * non-automated call. */
export interface CallDetail extends CommunicationLog {
  transcript: CommunicationLog[]
}

export interface CommunicationsCapabilities {
  communications_enabled: boolean
  voice_number_configured: boolean
  whatsapp_configured: boolean
  outbound_calling_supported: boolean
}

export interface CommunicationsOverview {
  calls_today: number
  missed_calls_today: number
  whatsapp_unread: number
  outgoing_contacts_today: number
  recent: CommunicationLog[]
  capabilities: CommunicationsCapabilities
}

export interface Conversation {
  phone: string
  customer: CommunicationCustomer | null
  last_message: CommunicationLog
  unread_count: number
}

export interface Paginated<T> {
  items: T[]
  total: number
}

function toQuery(params: object): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export function getOverview(): Promise<CommunicationsOverview> {
  return apiFetch<CommunicationsOverview>('/api/communications/overview')
}

export function getUnreadCount(): Promise<{ whatsapp_unread: number }> {
  return apiFetch('/api/communications/unread-count')
}

export interface CallListParams {
  direction?: 'INBOUND' | 'OUTBOUND'
  missed_only?: boolean
  search?: string
  limit?: number
  offset?: number
}

export function listCalls(params: CallListParams = {}): Promise<Paginated<CommunicationLog>> {
  return apiFetch(`/api/communications/calls${toQuery(params)}`)
}

export function getCall(id: string): Promise<CallDetail> {
  return apiFetch(`/api/communications/calls/${id}`)
}

export function initiateCall(data: { customer_id?: string; to?: string }): Promise<void> {
  return apiFetch('/api/communications/calls', { method: 'POST', body: data })
}

export interface ConversationListParams {
  search?: string
  limit?: number
  offset?: number
}

export function listConversations(
  params: ConversationListParams = {},
): Promise<Paginated<Conversation>> {
  return apiFetch(`/api/communications/conversations${toQuery(params)}`)
}

export interface ConversationMessages {
  phone: string
  customer: CommunicationCustomer | null
  messages: CommunicationLog[]
}

export function getConversationMessages(
  phone: string,
  params: { limit?: number } = {},
): Promise<ConversationMessages> {
  return apiFetch(
    `/api/communications/conversations/${encodeURIComponent(phone)}/messages${toQuery(params)}`,
  )
}

export function markConversationRead(phone: string): Promise<{ updated: number }> {
  return apiFetch(`/api/communications/conversations/${encodeURIComponent(phone)}/read`, {
    method: 'POST',
  })
}

export function sendWhatsAppMessage(data: {
  customer_id?: string
  to?: string
  body: string
}): Promise<CommunicationLog> {
  return apiFetch('/api/communications/whatsapp/send', { method: 'POST', body: data })
}

export function getCustomerCommunications(customerId: string): Promise<CommunicationLog[]> {
  return apiFetch(`/api/customers/${customerId}/communications`)
}

// --------------------------------------------------------------------------
// Communications automation settings - never a Twilio credential, those stay
// platform/CLI-only.
// --------------------------------------------------------------------------

export interface AutomationSettings {
  booking_ack_enabled: boolean
  booking_confirmation_enabled: boolean
  reminder_enabled: boolean
  reminder_hours_before: number
  missed_call_ack_enabled: boolean
  conversation_automation_enabled: boolean
}

export function getAutomationSettings(): Promise<AutomationSettings> {
  return apiFetch('/api/communications/automation-settings')
}

export function updateAutomationSettings(
  data: Partial<AutomationSettings>,
): Promise<AutomationSettings> {
  return apiFetch('/api/communications/automation-settings', { method: 'PUT', body: data })
}

// --------------------------------------------------------------------------
// Message templates - safe {{variable}} text only
// --------------------------------------------------------------------------

export interface MessageTemplate {
  key: string
  body: string
  default_body: string
  is_custom: boolean
}

export function listTemplates(): Promise<{ items: MessageTemplate[] }> {
  return apiFetch('/api/communications/templates')
}

export function updateTemplate(key: string, body: string): Promise<MessageTemplate> {
  return apiFetch(`/api/communications/templates/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: { body },
  })
}

export function resetTemplate(key: string): Promise<MessageTemplate> {
  return apiFetch(`/api/communications/templates/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  })
}

export function previewTemplate(key: string, body: string): Promise<{ preview: string }> {
  return apiFetch(`/api/communications/templates/${encodeURIComponent(key)}/preview`, {
    method: 'POST',
    body: { body },
  })
}

// --------------------------------------------------------------------------
// Callback requests
// --------------------------------------------------------------------------

export type CallbackStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED'

export interface CallbackRequest {
  id: string
  customer: CommunicationCustomer | null
  phone_number: string
  reason: string | null
  preferred_time: string | null
  status: CallbackStatus
  created_at: string
}

export interface CallbackRequestListParams {
  status?: CallbackStatus
  limit?: number
  offset?: number
}

export function listCallbackRequests(
  params: CallbackRequestListParams = {},
): Promise<Paginated<CallbackRequest>> {
  return apiFetch(`/api/communications/callback-requests${toQuery(params)}`)
}

export function completeCallbackRequest(id: string): Promise<CallbackRequest> {
  return apiFetch(`/api/communications/callback-requests/${id}/complete`, { method: 'POST' })
}

export function cancelCallbackRequest(id: string): Promise<CallbackRequest> {
  return apiFetch(`/api/communications/callback-requests/${id}/cancel`, { method: 'POST' })
}

// --------------------------------------------------------------------------
// Staff conversation takeover / resume automation - the bot and a human must
// never reply at the same time.
// --------------------------------------------------------------------------

export type ConversationSessionStatus = 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'HUMAN_HANDOFF'

export interface ConversationAutomationStatus {
  phone: string
  status: ConversationSessionStatus | null
  intent: string | null
  handoff_reason: string | null
}

export function getConversationAutomationStatus(
  phone: string,
): Promise<ConversationAutomationStatus> {
  return apiFetch(`/api/communications/conversations/${encodeURIComponent(phone)}/automation`)
}

export function takeoverConversation(phone: string): Promise<ConversationAutomationStatus> {
  return apiFetch(`/api/communications/conversations/${encodeURIComponent(phone)}/takeover`, {
    method: 'POST',
  })
}

export function resumeConversationAutomation(
  phone: string,
): Promise<ConversationAutomationStatus> {
  return apiFetch(
    `/api/communications/conversations/${encodeURIComponent(phone)}/resume-automation`,
    { method: 'POST' },
  )
}

// --------------------------------------------------------------------------
// Attention queue - conversations automation handed to a human
// --------------------------------------------------------------------------

export interface AttentionQueueItem {
  phone: string
  customer: CommunicationCustomer | null
  intent: string | null
  handoff_reason: string | null
  last_activity_at: string
}

export function listAttentionQueue(): Promise<{ items: AttentionQueueItem[] }> {
  return apiFetch('/api/communications/attention-queue')
}
