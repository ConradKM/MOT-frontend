import { apiFetch } from './client'
import type { Appointment, AppointmentStatus, AppointmentType } from '../types'

export interface AppointmentInput {
  employee_id: number
  customer_id: number
  vehicle_id?: number | null
  start_time: string
  end_time: string
  appointment_type: AppointmentType
  status?: AppointmentStatus
  notes?: string | null
}

export interface AppointmentListParams {
  date?: string
  start_date?: string
  end_date?: string
  employee_id?: number
  customer_id?: number
  vehicle_id?: number
  status?: AppointmentStatus
  appointment_type?: AppointmentType
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
  id: number,
  data: Partial<AppointmentInput>,
): Promise<Appointment> {
  return apiFetch<Appointment>(`/api/appointments/${id}`, { method: 'PATCH', body: data })
}

export function cancelAppointment(id: number): Promise<void> {
  return apiFetch<void>(`/api/appointments/${id}`, { method: 'DELETE' })
}
