import { apiFetch, apiFetchBlob } from './client'

/** Whose appointments: the signed-in employee, every worker (OWNER only), or
 * an explicit list (anyone but yourself is OWNER only). The API enforces this;
 * the dialog only hides what a STAFF user can't use. */
export type CalendarScope = 'ME' | 'ALL' | 'SELECTED'

/** The filter shared by a one-off download and a subscription feed.
 * `appointment_type_ids: null` means every type, including ones added later. */
export interface CalendarFilter {
  scope: CalendarScope
  employee_ids: string[]
  appointment_type_ids: string[] | null
}

export interface CalendarDownloadParams extends CalendarFilter {
  start_date: string
  end_date: string
}

export interface CalendarFeedInput extends CalendarFilter {
  name: string
  days_back: number
  days_forward: number
}

/** A feed as listed - never its URL, which only create/regenerate return. */
export interface CalendarFeed {
  id: string
  name: string
  scope: CalendarScope
  employee_ids: string[]
  appointment_type_ids: string[] | null
  days_back: number
  days_forward: number
  created_by_employee_id: string
  created_at: string
  last_accessed_at: string | null
}

export interface CalendarFeedWithUrl extends CalendarFeed {
  /** https:// - for Google Calendar's "From URL", or any client. Shown once. */
  subscription_url: string
  /** The same URL as webcal://, which Apple devices open as "Subscribe". */
  webcal_url: string
}

/** Repeated keys (`employee_ids=a&employee_ids=b`) - the shape the API reads
 * list query parameters in. Empty/absent selections are left out entirely. */
export function calendarDownloadQuery(params: CalendarDownloadParams): string {
  const query = new URLSearchParams({
    scope: params.scope,
    start_date: params.start_date,
    end_date: params.end_date,
  })
  if (params.scope === 'SELECTED') {
    for (const id of params.employee_ids) query.append('employee_ids', id)
  }
  if (params.appointment_type_ids !== null) {
    for (const id of params.appointment_type_ids) query.append('appointment_type_ids', id)
  }
  return query.toString()
}

export function downloadAppointmentsIcs(params: CalendarDownloadParams): Promise<Blob> {
  return apiFetchBlob(`/api/calendar-export/appointments.ics?${calendarDownloadQuery(params)}`)
}

export function listCalendarFeeds(): Promise<CalendarFeed[]> {
  return apiFetch<CalendarFeed[]>('/api/calendar-export/feeds')
}

export function createCalendarFeed(data: CalendarFeedInput): Promise<CalendarFeedWithUrl> {
  const body = { ...data, employee_ids: data.scope === 'SELECTED' ? data.employee_ids : [] }
  return apiFetch<CalendarFeedWithUrl>('/api/calendar-export/feeds', { method: 'POST', body })
}

export function regenerateCalendarFeed(id: string): Promise<CalendarFeedWithUrl> {
  return apiFetch<CalendarFeedWithUrl>(`/api/calendar-export/feeds/${id}/regenerate`, {
    method: 'POST',
  })
}

export function revokeCalendarFeed(id: string): Promise<void> {
  return apiFetch<void>(`/api/calendar-export/feeds/${id}`, { method: 'DELETE' })
}
