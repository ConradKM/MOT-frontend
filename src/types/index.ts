export interface Garage {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
  updated_at: string
}

/** A per-garage employee role — a tag, not a fixed enum. "OWNER" is reserved: every
 * garage has one, it can't be renamed/deleted, and having it grants owner-only actions. */
export interface Role {
  id: string
  garage_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  garage_id: string
  email: string
  first_name: string | null
  last_name: string | null
  is_active: boolean
  roles: Role[]
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

/** The seven built-in keys; a garage may also define its own, so any string is valid. */
export type AppointmentStatus =
  | 'REQUESTED'
  | 'BOOKED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ACTION_NEEDED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | (string & {})

/** A garage-configurable label + colour for an appointment status key. */
export interface GarageAppointmentStatus {
  id: string
  garage_id: string
  key: string
  label: string
  /** Colour token (e.g. "blue", "emerald") mapped to classes in lib/appointmentStatuses. */
  color: string
  sort_order: number
  is_terminal: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export type AppointmentTypeStatus = 'ACTIVE' | 'HIDDEN' | 'DEPRECATED'

/** A garage's own configurable appointment type (replaces the old global enum). */
export interface AppointmentType {
  id: string
  garage_id: string
  name: string
  description: string | null
  /** Serialized as a decimal string by the backend (e.g. "54.85"), not a JSON number. */
  base_price: string | null
  default_duration_minutes: number | null
  status: AppointmentTypeStatus
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  garage_id: string
  employee_id: string
  customer_id: string
  vehicle_id: string | null
  start_time: string
  end_time: string
  appointment_type_id: string
  status: AppointmentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type ChecklistItemMediaType = 'NONE' | 'PHOTO' | 'VIDEO' | 'EITHER'

/** Mirrors DVSA's MOT grading, extended for day-to-day service/repair work. */
export type ChecklistItemStatus =
  | 'PASS'
  | 'ADVISORY'
  | 'MINOR'
  | 'MAJOR'
  | 'DANGEROUS'
  | 'RECTIFIED'
  | 'RECOMMENDED'
  | 'CUSTOMER_DECLINED'
  | 'NOT_APPLICABLE'
  | 'NOT_CHECKED'

export interface ChecklistTemplateItem {
  id: string
  garage_id: string
  checklist_template_id: string
  order: number
  label: string
  is_compulsory: boolean
  media_type: ChecklistItemMediaType
  media_required_for_statuses: ChecklistItemStatus[]
  created_at: string
  updated_at: string
}

/** One per appointment type. Snapshotted onto an AppointmentChecklist the first time a
 * checklist is opened for an appointment of that type - later edits here don't
 * retroactively change an already-started checklist. */
export interface ChecklistTemplate {
  id: string
  garage_id: string
  appointment_type_id: string
  items: ChecklistTemplateItem[]
  created_at: string
  updated_at: string
}

export interface AppointmentChecklistItem {
  id: string
  garage_id: string
  appointment_checklist_id: string
  checklist_template_item_id: string | null
  order: number
  label: string
  is_compulsory: boolean
  media_type: ChecklistItemMediaType
  media_required_for_statuses: ChecklistItemStatus[]
  status: ChecklistItemStatus
  notes: string | null
  completed_by_employee_id: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

/** The per-appointment checklist instance - a snapshot of the template at the time it
 * was started, plus logged status/notes per item. */
export interface AppointmentChecklist {
  id: string
  garage_id: string
  appointment_id: string
  checklist_template_id: string | null
  items: AppointmentChecklistItem[]
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
