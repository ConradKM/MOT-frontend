import { apiFetch } from './client'

/**
 * What a business asks its customers while they book.
 *
 * A section with `appointment_type_id: null` is part of the business's
 * default workflow and is asked for every service. One naming a service is
 * that service's own override, and an override *replaces* the default rather
 * than adding to it - only "replace" can express dropping a default section
 * for one service.
 */

export type BookingFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'CHECKBOX'
  | 'DATE'
  | 'TIME'
  | 'EMAIL'
  | 'PHONE'
  | 'PHOTO'

/**
 * An answer may additionally populate a real record the business keeps, so a
 * business that tracks the thing it books in keeps those records - and
 * anything built on them - working. A business that tracks nothing never
 * binds a field and never meets the concept.
 */
export type FieldBinding =
  | 'ITEM_REFERENCE'
  | 'ITEM_MAKE'
  | 'ITEM_MODEL'
  | 'ITEM_YEAR'
  | 'ITEM_USAGE'

export interface BookingFlowField {
  id: string
  booking_flow_section_id: string
  label: string
  help_text: string | null
  placeholder: string | null
  field_type: BookingFieldType
  is_required: boolean
  options: string[]
  order: number
  min_value: number | null
  max_value: number | null
  max_length: number | null
  binds_to: FieldBinding | null
  created_at: string
  updated_at: string
}

export interface BookingFlowSection {
  id: string
  garage_id: string
  title: string
  description: string | null
  order: number
  is_active: boolean
  appointment_type_id: string | null
  fields: BookingFlowField[]
  created_at: string
  updated_at: string
}

export interface BookingFlowSectionInput {
  title: string
  description?: string | null
  order?: number
  is_active?: boolean
  appointment_type_id?: string | null
}

export interface BookingFlowFieldInput {
  label: string
  help_text?: string | null
  placeholder?: string | null
  field_type?: BookingFieldType
  is_required?: boolean
  options?: string[]
  order?: number
  min_value?: number | null
  max_value?: number | null
  max_length?: number | null
  binds_to?: FieldBinding | null
}

export function listBookingFlowSections(
  params: { appointmentTypeId?: string; defaultOnly?: boolean } = {},
): Promise<BookingFlowSection[]> {
  const qs = new URLSearchParams()
  if (params.appointmentTypeId) qs.set('appointment_type_id', params.appointmentTypeId)
  if (params.defaultOnly) qs.set('default_only', 'true')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<BookingFlowSection[]>(`/api/booking-flow/sections${suffix}`)
}

export function createBookingFlowSection(
  data: BookingFlowSectionInput,
): Promise<BookingFlowSection> {
  return apiFetch<BookingFlowSection>('/api/booking-flow/sections', { method: 'POST', body: data })
}

export function updateBookingFlowSection(
  id: string,
  data: Partial<BookingFlowSectionInput>,
): Promise<BookingFlowSection> {
  return apiFetch<BookingFlowSection>(`/api/booking-flow/sections/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deleteBookingFlowSection(id: string): Promise<void> {
  return apiFetch<void>(`/api/booking-flow/sections/${id}`, { method: 'DELETE' })
}

/** Reorder one workflow's sections. The ids must be all of one workflow. */
export function reorderBookingFlowSections(ids: string[]): Promise<void> {
  return apiFetch<void>('/api/booking-flow/sections/order', { method: 'PUT', body: { ids } })
}

export function createBookingFlowField(
  sectionId: string,
  data: BookingFlowFieldInput,
): Promise<BookingFlowField> {
  return apiFetch<BookingFlowField>(`/api/booking-flow/sections/${sectionId}/fields`, {
    method: 'POST',
    body: data,
  })
}

export function updateBookingFlowField(
  id: string,
  data: Partial<BookingFlowFieldInput>,
): Promise<BookingFlowField> {
  return apiFetch<BookingFlowField>(`/api/booking-flow/fields/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deleteBookingFlowField(id: string): Promise<void> {
  return apiFetch<void>(`/api/booking-flow/fields/${id}`, { method: 'DELETE' })
}

export function reorderBookingFlowFields(sectionId: string, ids: string[]): Promise<void> {
  return apiFetch<void>(`/api/booking-flow/sections/${sectionId}/fields/order`, {
    method: 'PUT',
    body: { ids },
  })
}

export interface BookingFlowPreset {
  key: string
  sections: string[]
}

export function listBookingFlowPresets(): Promise<{ presets: BookingFlowPreset[] }> {
  return apiFetch<{ presets: BookingFlowPreset[] }>('/api/booking-flow/presets')
}

/** Seed the business's default workflow. Refused (409) when one exists -
 * duplicating every section, or discarding what the business already built,
 * are both worse than saying no. */
export function applyBookingFlowPreset(preset: string): Promise<BookingFlowSection[]> {
  return apiFetch<BookingFlowSection[]>('/api/booking-flow/presets', {
    method: 'POST',
    body: { preset },
  })
}
