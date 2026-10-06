import { apiFetch } from './client'
import type { AddOn, AppointmentTypeStatus } from '../types'

export interface AddOnInput {
  name: string
  description?: string | null
  price_delta?: string
  duration_delta_minutes?: number
  max_quantity?: number
  exclusivity_group?: string | null
  status?: AppointmentTypeStatus
  order?: number
}

const base = (appointmentTypeId: string) => `/api/appointment-types/${appointmentTypeId}/add-ons`

export function listAddOns(appointmentTypeId: string): Promise<AddOn[]> {
  return apiFetch<AddOn[]>(base(appointmentTypeId))
}

export function createAddOn(appointmentTypeId: string, data: AddOnInput): Promise<AddOn> {
  return apiFetch<AddOn>(base(appointmentTypeId), { method: 'POST', body: data })
}

export function updateAddOn(
  appointmentTypeId: string,
  id: string,
  data: Partial<AddOnInput>,
): Promise<AddOn> {
  return apiFetch<AddOn>(`${base(appointmentTypeId)}/${id}`, { method: 'PATCH', body: data })
}

export function deleteAddOn(appointmentTypeId: string, id: string): Promise<void> {
  return apiFetch<void>(`${base(appointmentTypeId)}/${id}`, { method: 'DELETE' })
}
