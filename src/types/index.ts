export interface Garage {
  id: string
  name: string
  /** Public, generated at onboarding, immutable. Not editable by garage users. */
  slug: string
  /** Platform-controlled layout key (see lib/layoutVariant). null = shared default. */
  layout_variant: string | null
  /** Customer-facing business details. Read-only to garage users - the platform
   * edits them. Source of truth for future phone/email/SMS/confirmation systems. */
  email: string | null
  phone: string | null
  address: string | null
  postcode: string | null
  website: string | null
  /** A fresh, short-lived download url each request, or null with no logo -
   * set from Platform Admin, read-only here. Render the initials fallback on
   * null, never a broken-image icon. */
  logo_url: string | null
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
  /** False once archived (soft-deleted) - hidden from the main list but
   * still reachable by id. See api/customers.ts. */
  is_active: boolean
  /** Future SMS use - not actionable anywhere yet. */
  sms_opt_out: boolean
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
  /** False once archived (soft-deleted) - see api/vehicles.ts. */
  is_active: boolean
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

export type DepositType = 'FIXED' | 'PERCENTAGE'

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
  deposit_required: boolean
  deposit_type: DepositType | null
  /** Decimal string - a GBP amount for FIXED, a 0-100 number for PERCENTAGE. */
  deposit_value: string | null
  deposit_currency: string
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
  /** Snapshot of the appointment type's price when this was created - stays
   * accurate even if the type's price changes later. Decimal string or null. */
  price_at_booking: string | null
  created_at: string
  updated_at: string
}

export type ChecklistItemMediaType = 'NONE' | 'PHOTO' | 'VIDEO' | 'EITHER'

/** No fixed platform-wide enum - a checklist item's valid results are its own
 * `result_options` (see ChecklistTemplateItem). This automotive/DVSA-style set
 * is offered as one selectable preset, not assumed for every business - any
 * string an item's own result_options names is a real value. */
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
  | 'DONE'
  | (string & {})

/** The generic, non-automotive default a brand-new checklist item gets. */
export const GENERIC_RESULT_OPTIONS: ChecklistItemStatus[] = [
  'NOT_CHECKED',
  'DONE',
  'NOT_APPLICABLE',
]

/** The automotive/DVSA-style preset, selectable per item. */
export const AUTOMOTIVE_RESULT_OPTIONS: ChecklistItemStatus[] = [
  'PASS',
  'ADVISORY',
  'MINOR',
  'MAJOR',
  'DANGEROUS',
  'RECTIFIED',
  'RECOMMENDED',
  'CUSTOMER_DECLINED',
  'NOT_APPLICABLE',
  'NOT_CHECKED',
]

export interface ChecklistTemplateItem {
  id: string
  garage_id: string
  checklist_template_id: string
  order: number
  label: string
  /** Optional extra instruction beyond the label, e.g. "torque to spec". */
  description: string | null
  is_compulsory: boolean
  media_type: ChecklistItemMediaType
  media_required_for_statuses: ChecklistItemStatus[]
  /** The values staff can log against this item - configurable per item so
   * non-automotive businesses aren't forced into DVSA-style grading. */
  result_options: ChecklistItemStatus[]
  /** Shown on the public booking page's "what's included" summary when true. */
  visible_to_customer: boolean
  created_at: string
  updated_at: string
}

/** One per appointment type. Snapshotted onto an AppointmentChecklist as soon
 * as an appointment of that type is created - later edits here don't
 * retroactively change an already-created checklist. */
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
  description: string | null
  is_compulsory: boolean
  media_type: ChecklistItemMediaType
  media_required_for_statuses: ChecklistItemStatus[]
  /** Snapshotted from the template item at creation time - see the module
   * docstring on the backend AppointmentChecklistItem model. */
  result_options: ChecklistItemStatus[]
  visible_to_customer: boolean
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
