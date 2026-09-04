import { apiFetch } from './client'

export type MOTReminderStatus = 'scheduled' | 'sent' | 'not_scheduled'

export interface MOTReminderRow {
  vehicle_id: string
  customer_id: string
  customer_name: string
  registration_number: string
  make: string | null
  model: string | null
  mot_expiry_date: string
  reminder_status: MOTReminderStatus
  last_reminder_sent: string | null
  next_reminder_scheduled: string | null
}

export function listMOTReminders(): Promise<MOTReminderRow[]> {
  return apiFetch<MOTReminderRow[]>('/api/mot-reminders/')
}
