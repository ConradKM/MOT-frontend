import type { AppointmentStatus, MOTResult } from '../types'
import { customerApiFetch } from './customerClient'

// Shapes returned by the read-only customer portal (app/customer_portal on the
// backend). Narrower than the staff types in src/types — the customer view
// only ever sees a subset of each record.

export interface CustomerProfile {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  garage_name: string
  /** Whether email + password sign-in is set up yet. */
  has_password: boolean
}

export interface CustomerMOTRecord {
  id: string
  mot_date: string
  expiry_date: string
  result: MOTResult
  notes: string | null
}

export interface CustomerVehicle {
  id: string
  registration_number: string
  make: string | null
  model: string | null
  year: number | null
  current_mileage: number | null
  mot_expiry_date: string | null
  /** Newest first. */
  mot_records: CustomerMOTRecord[]
}

export interface CustomerAppointmentSummary {
  id: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes: string | null
  appointment_type_name: string
  vehicle_registration: string | null
}

export interface CustomerAccount {
  customer: CustomerProfile
  vehicles: CustomerVehicle[]
  appointments: CustomerAppointmentSummary[]
}

export interface CustomerAppointmentDetail {
  id: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  notes: string | null
  appointment_type_name: string
  appointment_type_description: string | null
  vehicle: {
    registration_number: string
    make: string | null
    model: string | null
    year: number | null
  } | null
  garage_name: string
}

export function getCustomerAccount(): Promise<CustomerAccount> {
  return customerApiFetch<CustomerAccount>('/api/customer/account')
}

export function getCustomerAppointment(id: string): Promise<CustomerAppointmentDetail> {
  return customerApiFetch<CustomerAppointmentDetail>(`/api/customer/appointments/${id}`)
}
