import { apiFetch } from './client'

export type BookingRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

export interface RequestAppointmentType {
  id: string
  name: string
  description: string | null
  base_price: string | null
  default_duration_minutes: number | null
  status: string
}

export interface SlotCheck {
  /** False when there's no preferred time to check, or the request is no
   * longer PENDING - `available` is meaningless in that case. */
  checked: boolean
  available: boolean | null
  reason: string | null
}

export interface BookingRequest {
  id: string
  garage_id: string
  status: BookingRequestStatus
  customer_first_name: string
  customer_last_name: string
  customer_full_name: string
  customer_email: string
  customer_phone: string | null
  vehicle_registration: string
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  vehicle_mileage: number | null
  appointment_type_id: string | null
  appointment_type: RequestAppointmentType | null
  duration_minutes: number | null
  /** What the customer actually saw/chose at submission time - stays
   * accurate even if the type is edited or deleted afterwards. */
  requested_duration_minutes: number | null
  requested_price: string | null
  preferred_date: string
  preferred_time: string | null
  preferred_employee_note: string | null
  notes: string | null
  is_expired: boolean
  slot_check: SlotCheck
  reviewed_by_employee_id: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  staff_notes: string | null
  customer_id: string | null
  vehicle_id: string | null
  appointment_id: string | null
  created_at: string
  updated_at: string
}

export interface ApproveBookingRequestInput {
  employee_id: string
  appointment_type_id?: string | null
  start_time?: string | null
  end_time?: string | null
  staff_notes?: string | null
}

export function listBookingRequests(
  params: { status?: BookingRequestStatus } = {},
): Promise<BookingRequest[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<BookingRequest[]>(`/api/booking-requests/${suffix}`)
}

export function getBookingRequest(id: string): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/api/booking-requests/${id}`)
}

export function approveBookingRequest(
  id: string,
  data: ApproveBookingRequestInput,
): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/api/booking-requests/${id}/approve`, {
    method: 'POST',
    body: data,
  })
}

export function rejectBookingRequest(
  id: string,
  data: { staff_notes?: string | null },
): Promise<BookingRequest> {
  return apiFetch<BookingRequest>(`/api/booking-requests/${id}/reject`, {
    method: 'POST',
    body: data,
  })
}
