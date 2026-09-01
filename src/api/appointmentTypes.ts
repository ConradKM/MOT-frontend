import { apiFetch } from './client'
import type { AppointmentType, AppointmentTypeStatus } from '../types'

export function listAppointmentTypes(
  params: { status?: AppointmentTypeStatus } = {},
): Promise<AppointmentType[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<AppointmentType[]>(`/api/appointment-types/${suffix}`)
}
