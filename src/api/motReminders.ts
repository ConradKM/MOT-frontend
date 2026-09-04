import { apiFetch } from './client'

export type MOTReminderStatus =
  | 'booked'
  | 'scheduled'
  | 'sent'
  | 'expired'
  | 'not_scheduled'

export type ReminderStage = 'STAGE_1' | 'STAGE_2' | 'STAGE_3'
export type ReminderStageState =
  | 'sent'
  | 'scheduled'
  | 'suppressed'
  | 'disabled'
  | 'expired'

export interface ReminderStageRow {
  stage: ReminderStage
  days_before: number
  enabled: boolean
  state: ReminderStageState
  sent_at: string | null
  /** YYYY-MM-DD */
  scheduled_for: string | null
}

export interface ReminderHistoryEntry {
  stage: ReminderStage | 'MANUAL' | null
  trigger: 'AUTOMATIC' | 'MANUAL'
  channel: string
  status: 'SENT' | 'SKIPPED' | 'FAILED' | 'PENDING'
  sent_at: string | null
  scheduled_at: string
  detail: string | null
  initiated_by: string | null
}

export interface MOTReminderRow {
  vehicle_id: string
  customer_id: string
  customer_name: string
  customer_email: string | null
  registration_number: string
  make: string | null
  model: string | null
  /** YYYY-MM-DD */
  mot_expiry_date: string
  reminder_status: MOTReminderStatus
  booking_active: boolean
  last_reminder_sent: string | null
  /** YYYY-MM-DD, or null when nothing is eligible (booking / expired / done). */
  next_reminder_scheduled: string | null
  can_send_manual: boolean
  stages: ReminderStageRow[]
  history: ReminderHistoryEntry[]
}

export interface MOTReminderSettings {
  id: string | null
  stage1_enabled: boolean
  stage1_days_before: number
  stage2_enabled: boolean
  stage2_days_before: number
  stage3_enabled: boolean
  stage3_days_before: number
}

export type MOTReminderSettingsInput = Partial<Omit<MOTReminderSettings, 'id'>>

export interface ManualReminderResult {
  stage: string
  trigger: string
  channel: string
  status: string
  sent_at: string | null
  detail: string | null
}

export function listMOTReminders(): Promise<MOTReminderRow[]> {
  return apiFetch<MOTReminderRow[]>('/api/mot-reminders/')
}

export function getMOTReminderSettings(): Promise<MOTReminderSettings> {
  return apiFetch<MOTReminderSettings>('/api/mot-reminders/settings')
}

export function updateMOTReminderSettings(
  data: MOTReminderSettingsInput,
): Promise<MOTReminderSettings> {
  return apiFetch<MOTReminderSettings>('/api/mot-reminders/settings', {
    method: 'PUT',
    body: data,
  })
}

export function sendManualReminder(
  vehicleId: string,
  opts: { acknowledge_booking?: boolean } = {},
): Promise<ManualReminderResult> {
  return apiFetch<ManualReminderResult>(`/api/mot-reminders/${vehicleId}/send`, {
    method: 'POST',
    body: opts,
  })
}
