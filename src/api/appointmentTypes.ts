import { apiFetch } from './client'
import type { AppointmentType, AppointmentTypeStatus } from '../types'

export interface AppointmentTypeInput {
  name: string
  description?: string | null
  /** Decimal string, e.g. "54.85". */
  base_price?: string | null
  default_duration_minutes?: number | null
  status?: AppointmentTypeStatus
}

export function listAppointmentTypes(
  params: { status?: AppointmentTypeStatus } = {},
): Promise<AppointmentType[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<AppointmentType[]>(`/api/appointment-types/${suffix}`)
}

export function getAppointmentType(id: string): Promise<AppointmentType> {
  return apiFetch<AppointmentType>(`/api/appointment-types/${id}`)
}

export function createAppointmentType(data: AppointmentTypeInput): Promise<AppointmentType> {
  return apiFetch<AppointmentType>('/api/appointment-types/', { method: 'POST', body: data })
}

export function updateAppointmentType(
  id: string,
  data: Partial<AppointmentTypeInput>,
): Promise<AppointmentType> {
  return apiFetch<AppointmentType>(`/api/appointment-types/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deleteAppointmentType(id: string): Promise<void> {
  return apiFetch<void>(`/api/appointment-types/${id}`, { method: 'DELETE' })
}
