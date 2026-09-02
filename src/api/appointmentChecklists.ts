import { apiFetch } from './client'
import type { AppointmentChecklist, AppointmentChecklistItem, ChecklistItemStatus } from '../types'

export function getAppointmentChecklist(appointmentId: string): Promise<AppointmentChecklist> {
  return apiFetch<AppointmentChecklist>(`/api/appointments/${appointmentId}/checklist`)
}

export function startAppointmentChecklist(appointmentId: string): Promise<AppointmentChecklist> {
  return apiFetch<AppointmentChecklist>(`/api/appointments/${appointmentId}/checklist`, {
    method: 'POST',
  })
}

export function updateAppointmentChecklistItem(
  checklistId: string,
  itemId: string,
  data: { status?: ChecklistItemStatus; notes?: string | null },
): Promise<AppointmentChecklistItem> {
  return apiFetch<AppointmentChecklistItem>(
    `/api/appointment-checklists/${checklistId}/items/${itemId}`,
    { method: 'PATCH', body: data },
  )
}
