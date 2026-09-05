import { apiFetch } from './client'

// Mirrors app/models/conversation/conversation_session.py::CHANNELS
export type SimulatorChannel = 'VOICE' | 'WHATSAPP'

export interface SimulateMessageInput {
  channel: SimulatorChannel
  phone: string
  text: string
}

export interface ConversationResult {
  session_id: string
  response_text: string | null
  intent: string
  workflow_step: string | null
  actions_performed: string[]
  needs_human: boolean
  duplicate: boolean
}

/** Development-only: runs a message through the real conversation engine,
 * no Twilio involved. The backend itself 404s this once
 * CONVERSATION_SIMULATOR_ENABLED=false in a production deployment - this
 * file has no opinion on that, it just calls the endpoint. */
export function simulateMessage(data: SimulateMessageInput): Promise<ConversationResult> {
  return apiFetch('/api/conversation/simulate', { method: 'POST', body: data })
}
