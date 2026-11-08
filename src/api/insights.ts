import { apiFetch, apiFetchBlob } from './client'

/** GBP amounts arrive as decimal strings ("80.00"), like every price in this API. */
export type Money = string

/** An advanced section on a plan without `insights_advanced`. */
export interface LockedSection {
  locked: true
  feature: 'insights_advanced'
}

export function isLocked(section: unknown): section is LockedSection {
  return !!section && typeof section === 'object' && (section as LockedSection).locked === true
}

export interface AppointmentOutcomes {
  total: number
  by_status: Record<string, number>
  completed: number
  no_show: number
  cancelled: number
  upcoming: number
  completion_rate: number | null
  no_show_rate: number | null
  cancellation_rate: number | null
}

export interface BookingRequestOutcomes {
  total: number
  pending: number
  approved: number
  rejected: number
  expired: number
  approval_rate: number | null
  rejection_rate: number | null
  expiry_rate: number | null
}

/** Money fields are present for owners only - absent (not zero) for staff. */
export interface InsightsSummary {
  appointments: AppointmentOutcomes
  lost_count: number
  customers_seen: number
  new_customers: number
  returning_customers: number
  returning_rate: number | null
  /** Null in a view scoped to one employee - requests aren't assigned to staff. */
  booking_requests: BookingRequestOutcomes | null
  booked_value?: Money
  discounts_given?: Money
  lost_value?: Money
  deposits_collected?: Money
  deposits_count?: number
  unpriced_appointments?: number
}

export interface TopService {
  appointment_type_id: string
  name: string
  appointments: number
  completed: number
  booked_value?: Money
}

export interface TopServices {
  services: TopService[]
  add_ons: { name: string; appointments: number; quantity: number }[]
  appointments_with_add_ons: number
  add_on_uptake_rate: number | null
}

export type Granularity = 'day' | 'week' | 'month'

export interface TrendPoint {
  bucket_start: string
  appointments: number
  new_customers: number
  booked_value?: Money
}

export interface Trend {
  granularity: Granularity
  points: TrendPoint[]
}

export interface Heatmap {
  /** weekday: ISO, 1 = Monday. Only non-empty cells are sent. */
  cells: { weekday: number; hour: number; appointments: number }[]
  max: number
}

export interface StaffRow {
  employee_id: string
  name: string
  appointments: number
  completed: number
  no_show: number
  cancelled: number
  completion_rate: number | null
  no_show_rate: number | null
  booked_value: Money
}

export interface DueBackItem {
  customer_id: string
  customer_name: string
  appointment_type_id: string
  service_name: string
  vehicle_id: string | null
  vehicle_registration: string | null
  last_visit: string
  due_date: string
  status: 'due' | 'due_soon'
  basis: 'interval' | 'mot_expiry'
}

export interface DueBackPage {
  as_of: string
  due_soon_days: number
  due: number
  due_soon: number
  total: number
  page: number
  per_page: number
  items: DueBackItem[]
}

export interface CustomersSection {
  new_customers: number
  returning_customers: number
  returning_rate: number | null
  due_back: DueBackPage
}

export interface InsightsPeriod {
  start: string
  end: string
  days: number
  granularity?: Granularity
  timezone?: string
}

export interface Insights {
  period: InsightsPeriod
  previous_period: InsightsPeriod
  scope: { employee_id: string | null; money_visible: boolean; advanced: boolean }
  summary: InsightsSummary
  previous_summary: InsightsSummary
  top_services: TopServices
  /** Bookings by channel: web, conversation, queue, import, staff. */
  sources: Record<string, number>
  trend: Trend | LockedSection
  heatmap: Heatmap | LockedSection
  /** Null for a staff member's own view. */
  staff: { rows: StaffRow[] } | LockedSection | null
  customers: CustomersSection | LockedSection
  export: { locked: false } | LockedSection
}

export interface InsightsParams {
  start: string
  end: string
  employeeId?: string | null
}

function query({ start, end, employeeId }: InsightsParams): string {
  const params = new URLSearchParams({ start, end })
  if (employeeId) params.set('employee_id', employeeId)
  return params.toString()
}

export function getInsights(params: InsightsParams): Promise<Insights> {
  return apiFetch<Insights>(`/api/insights?${query(params)}`)
}

export function getDueBack(page: number, employeeId?: string | null): Promise<DueBackPage> {
  const params = new URLSearchParams({ page: String(page) })
  if (employeeId) params.set('employee_id', employeeId)
  return apiFetch<DueBackPage>(`/api/insights/due-back?${params}`)
}

export function downloadInsightsCsv(params: InsightsParams): Promise<Blob> {
  return apiFetchBlob(`/api/insights/export.csv?${query(params)}`)
}
