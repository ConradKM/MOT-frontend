import { apiFetch } from './client'
import type { GarageAppointmentStatus } from '../types'

export interface AppointmentStatusInput {
  label: string
  color: string
  key?: string
  sort_order?: number
  is_terminal?: boolean
}

export function listAppointmentStatuses(): Promise<GarageAppointmentStatus[]> {
  return apiFetch<GarageAppointmentStatus[]>('/api/appointment-statuses/')
}

export function createAppointmentStatus(
  data: AppointmentStatusInput,
): Promise<GarageAppointmentStatus> {
  return apiFetch<GarageAppointmentStatus>('/api/appointment-statuses/', {
    method: 'POST',
    body: data,
  })
}

export function updateAppointmentStatus(
  id: string,
  data: Partial<Omit<AppointmentStatusInput, 'key'>>,
): Promise<GarageAppointmentStatus> {
  return apiFetch<GarageAppointmentStatus>(`/api/appointment-statuses/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deleteAppointmentStatus(id: string): Promise<void> {
  return apiFetch<void>(`/api/appointment-statuses/${id}`, { method: 'DELETE' })
}
