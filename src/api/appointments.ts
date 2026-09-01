import { apiFetch } from './client'
import type { Appointment, AppointmentStatus } from '../types'

export interface AppointmentInput {
  employee_id: string
  customer_id: string
  vehicle_id?: string | null
  start_time: string
  end_time: string
  appointment_type_id: string
  status?: AppointmentStatus
  notes?: string | null
}

export interface AppointmentListParams {
  date?: string
  start_date?: string
  end_date?: string
  employee_id?: string
  customer_id?: string
  vehicle_id?: string
  status?: AppointmentStatus
  appointment_type_id?: string
}

export function listAppointments(params: AppointmentListParams = {}): Promise<Appointment[]> {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<Appointment[]>(`/api/appointments/${suffix}`)
}

export function createAppointment(data: AppointmentInput): Promise<Appointment> {
  return apiFetch<Appointment>('/api/appointments/', { method: 'POST', body: data })
}

export function updateAppointment(
  id: string,
  data: Partial<AppointmentInput>,
): Promise<Appointment> {
  return apiFetch<Appointment>(`/api/appointments/${id}`, { method: 'PATCH', body: data })
}

export function cancelAppointment(id: string): Promise<void> {
  return apiFetch<void>(`/api/appointments/${id}`, { method: 'DELETE' })
}
