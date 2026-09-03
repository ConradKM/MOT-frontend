import { apiFetch } from './client'

export type BookingRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface BookingRequest {
  id: string
  garage_id: string
  status: BookingRequestStatus
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_phone: string | null
  vehicle_registration: string
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  vehicle_mileage: number | null
  appointment_type_id: string | null
  preferred_date: string
  preferred_time: string | null
  preferred_employee_note: string | null
  notes: string | null
  reviewed_by_employee_id: string | null
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
