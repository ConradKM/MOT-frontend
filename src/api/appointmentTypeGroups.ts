import { apiFetch } from './client'
import type { AppointmentTypeGroup, DisplayMode } from '../types'

export interface AppointmentTypeGroupInput {
  name: string
  description?: string | null
  order?: number
  /** Null = inherit the business-wide default. */
  display_mode?: DisplayMode | null
}

export function listAppointmentTypeGroups(): Promise<AppointmentTypeGroup[]> {
  // Trailing slash: the backend only registers the slashed collection route,
  // and the 308 it would otherwise issue breaks the dev proxy (see #9).
  return apiFetch<AppointmentTypeGroup[]>('/api/appointment-type-groups/')
}

export function createAppointmentTypeGroup(
  data: AppointmentTypeGroupInput,
): Promise<AppointmentTypeGroup> {
  return apiFetch<AppointmentTypeGroup>('/api/appointment-type-groups/', {
    method: 'POST',
    body: data,
  })
}

export function updateAppointmentTypeGroup(
  id: string,
  data: Partial<AppointmentTypeGroupInput>,
): Promise<AppointmentTypeGroup> {
  return apiFetch<AppointmentTypeGroup>(`/api/appointment-type-groups/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deleteAppointmentTypeGroup(id: string): Promise<void> {
  return apiFetch<void>(`/api/appointment-type-groups/${id}`, { method: 'DELETE' })
}

/**
 * Apply a whole new order in one request.
 *
 * `ids` must list every group exactly once - a partial list would leave the
 * omitted ones at stale positions, colliding with the new ones. One request
 * rather than a PATCH per moved row, which costs two round trips per single
 * move and can half-apply.
 */
export function reorderAppointmentTypeGroups(ids: string[]): Promise<AppointmentTypeGroup[]> {
  return apiFetch<AppointmentTypeGroup[]>('/api/appointment-type-groups/order', {
    method: 'PUT',
    body: { ids },
  })
}

/** Order the services inside one group. Same all-or-nothing rule. */
export function reorderGroupServices(groupId: string, ids: string[]): Promise<void> {
  return apiFetch<void>(`/api/appointment-type-groups/${groupId}/services/order`, {
    method: 'PUT',
    body: { ids },
  })
}
