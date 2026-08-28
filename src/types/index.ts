export type Role = 'OWNER' | 'STAFF'

export interface Garage {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  garage_id: string
  email: string
  role: Role
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  garage_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  garage_id: string
  customer_id: string
  registration_number: string
  make: string | null
  model: string | null
  year: number | null
  current_mileage: number | null
  mot_expiry_date: string | null
  created_at: string
  updated_at: string
}

export type MOTResult = 'PASS' | 'FAIL'

export interface MOTRecord {
  id: string
  garage_id: string
  vehicle_id: string
  mot_date: string
  expiry_date: string
  result: MOTResult
  notes: string | null
  created_at: string
  updated_at: string
}

export type AppointmentType = 'MOT' | 'SERVICE' | 'MOT_AND_SERVICE' | 'REPAIR' | 'OTHER'
export type AppointmentStatus = 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export interface Appointment {
  id: string
  garage_id: string
  employee_id: string
  customer_id: string
  vehicle_id: string | null
  start_time: string
  end_time: string
  appointment_type: AppointmentType
  status: AppointmentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ApiErrorBody {
  code: number
  status: string
  message?: string
  /** Raw flask-jwt-extended error responses use `msg` instead of `message`. */
  msg?: string
  errors?: {
    json?: Record<string, string[]>
    query?: Record<string, string[]>
  }
}
