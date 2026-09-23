import { apiFetch } from './client'

/** Not automotive-specific on purpose - "Appointment Reminders" applies to
 * any business with scheduled appointments/bookings. */
export type ReminderChannel = 'email' | 'sms' | 'whatsapp'

export interface AppointmentReminderTiming {
  id: string | null
  /** How long before the appointment this timing fires. */
  hours_before: number
  enabled: boolean
}

export interface AppointmentReminderSettings {
  id: string | null
  enabled: boolean
  /** Channels selected, in priority order. */
  channels: ReminderChannel[]
  /** Channels this business can actually send on right now - never claim a
   * channel works when the tenant isn't configured for it. */
  available_channels: ReminderChannel[]
  timings: AppointmentReminderTiming[]
}

export interface AppointmentReminderSettingsInput {
  enabled: boolean
  channels: ReminderChannel[]
  timings: { hours_before: number; enabled: boolean }[]
}

export function getAppointmentReminderSettings(): Promise<AppointmentReminderSettings> {
  return apiFetch<AppointmentReminderSettings>('/api/reminders/appointment-settings')
}

export function updateAppointmentReminderSettings(
  data: AppointmentReminderSettingsInput,
): Promise<AppointmentReminderSettings> {
  return apiFetch<AppointmentReminderSettings>('/api/reminders/appointment-settings', {
    method: 'PUT',
    body: data,
  })
}
