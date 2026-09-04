import { apiFetch } from './client'
import type { ChecklistItemMediaType, ChecklistItemStatus, ChecklistTemplate, ChecklistTemplateItem } from '../types'

export interface ChecklistTemplateItemInput {
  label: string
  description?: string | null
  order?: number
  is_compulsory?: boolean
  media_type?: ChecklistItemMediaType
  media_required_for_statuses?: ChecklistItemStatus[]
  result_options?: ChecklistItemStatus[]
  visible_to_customer?: boolean
}

export function getChecklistTemplate(appointmentTypeId: string): Promise<ChecklistTemplate> {
  return apiFetch<ChecklistTemplate>(`/api/appointment-types/${appointmentTypeId}/checklist-template`)
}

export function createChecklistTemplate(appointmentTypeId: string): Promise<ChecklistTemplate> {
  return apiFetch<ChecklistTemplate>(`/api/appointment-types/${appointmentTypeId}/checklist-template`, {
    method: 'POST',
  })
}

export function deleteChecklistTemplate(appointmentTypeId: string): Promise<void> {
  return apiFetch<void>(`/api/appointment-types/${appointmentTypeId}/checklist-template`, {
    method: 'DELETE',
  })
}

export function createChecklistTemplateItem(
  appointmentTypeId: string,
  data: ChecklistTemplateItemInput,
): Promise<ChecklistTemplateItem> {
  return apiFetch<ChecklistTemplateItem>(
    `/api/appointment-types/${appointmentTypeId}/checklist-template/items`,
    { method: 'POST', body: data },
  )
}

export function updateChecklistTemplateItem(
  appointmentTypeId: string,
  itemId: string,
  data: Partial<ChecklistTemplateItemInput>,
): Promise<ChecklistTemplateItem> {
  return apiFetch<ChecklistTemplateItem>(
    `/api/appointment-types/${appointmentTypeId}/checklist-template/items/${itemId}`,
    { method: 'PATCH', body: data },
  )
}

export function deleteChecklistTemplateItem(appointmentTypeId: string, itemId: string): Promise<void> {
  return apiFetch<void>(
    `/api/appointment-types/${appointmentTypeId}/checklist-template/items/${itemId}`,
    { method: 'DELETE' },
  )
}
