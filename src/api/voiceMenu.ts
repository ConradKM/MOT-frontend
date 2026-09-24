import { apiFetch } from './client'

/**
 * Settings › Communications › Phone menu - the business's own incoming-call
 * menu (IVR), played before the AI assistant. Backend:
 * GET/PUT /api/communications/voice-menu (app/communications/ivr). Hooks:
 * ./voiceMenuQueries.ts.
 */

export type VoiceMenuAction = 'AI_BOOKING' | 'AI_FAQ' | 'HUMAN_TRANSFER' | 'REPEAT_MENU'

export interface VoiceMenuOption {
  digit: string
  label: string
  prompt: string | null
  action: VoiceMenuAction
  target: string | null
}

export interface VoiceMenuActionInfo {
  key: VoiceMenuAction
  label: string
  accepts_target: boolean
  can_be_fallback: boolean
  available: boolean
}

export interface VoiceMenu {
  enabled: boolean
  greeting: string | null
  options: VoiceMenuOption[]
  fallback_action: VoiceMenuAction
  fallback_target: string | null
  max_attempts: number
  ai_available: boolean
  platform_transfer_configured: boolean
  supported_actions: VoiceMenuActionInfo[]
}

export type VoiceMenuInput = Pick<
  VoiceMenu,
  'enabled' | 'greeting' | 'options' | 'fallback_action' | 'fallback_target' | 'max_attempts'
>

export function getVoiceMenu(): Promise<VoiceMenu> {
  return apiFetch('/api/communications/voice-menu')
}

export function updateVoiceMenu(data: VoiceMenuInput): Promise<VoiceMenu> {
  return apiFetch('/api/communications/voice-menu', { method: 'PUT', body: data })
}
