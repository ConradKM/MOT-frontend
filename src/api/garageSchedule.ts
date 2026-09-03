import { apiFetch } from './client'

export interface ScheduleSettings {
  id: string
  slot_interval_minutes: number
  default_appointment_minutes: number
  min_lead_time_hours: number
  max_advance_days: number
  /** null => capacity falls back to the garage's active employee count */
  capacity_per_slot: number | null
  limited_threshold_ratio: number
}

export interface OpeningHoursRow {
  id: string
  /** 0 = Monday … 6 = Sunday */
  weekday: number
  opens_at: string
  closes_at: string
  is_closed: boolean
}

export interface ScheduleException {
  id: string
  /** YYYY-MM-DD */
  date: string
  is_closed: boolean
  opens_at: string | null
  closes_at: string | null
  note: string | null
}

export interface GarageSchedule {
  settings: ScheduleSettings
  opening_hours: OpeningHoursRow[]
  exceptions: ScheduleException[]
}

export type ScheduleSettingsInput = Partial<
  Omit<ScheduleSettings, 'id'>
>

export interface OpeningHoursInput {
  weekday: number
  opens_at: string
  closes_at: string
  is_closed: boolean
}

export interface ScheduleExceptionInput {
  date: string
  is_closed: boolean
  opens_at?: string | null
  closes_at?: string | null
  note?: string | null
}

export function getGarageSchedule(): Promise<GarageSchedule> {
  return apiFetch<GarageSchedule>('/api/garage/schedule')
}

export function updateScheduleSettings(
  data: ScheduleSettingsInput,
): Promise<ScheduleSettings> {
  return apiFetch<ScheduleSettings>('/api/garage/schedule/settings', {
    method: 'PUT',
    body: data,
  })
}

export function updateOpeningHours(
  opening_hours: OpeningHoursInput[],
): Promise<GarageSchedule> {
  return apiFetch<GarageSchedule>('/api/garage/schedule/opening-hours', {
    method: 'PUT',
    body: { opening_hours },
  })
}

export function addScheduleException(
  data: ScheduleExceptionInput,
): Promise<ScheduleException> {
  return apiFetch<ScheduleException>('/api/garage/schedule/exceptions', {
    method: 'POST',
    body: data,
  })
}

export function deleteScheduleException(id: string): Promise<void> {
  return apiFetch<void>(`/api/garage/schedule/exceptions/${id}`, {
    method: 'DELETE',
  })
}
