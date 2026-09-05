import { apiFetch } from './client'

export type CommChannel = 'VOICE' | 'WHATSAPP' | 'SMS' | 'EMAIL'
export type CommDirection = 'INBOUND' | 'OUTBOUND'

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

export function getCall(id: string): Promise<CommunicationLog> {
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
