import type { AppointmentStatus, AppointmentType } from '../types'

export const appointmentTypeLabels: Record<AppointmentType, string> = {
  MOT: 'MOT',
  SERVICE: 'Service',
  MOT_AND_SERVICE: 'MOT + Service',
  REPAIR: 'Repair',
  OTHER: 'Other',
}

/**
 * Placeholder copy until garages can define their own appointment types with real
 * descriptions and pricing (see MOT-backend issue #8) — swap this out once that lands.
 */
export const appointmentTypeDescriptions: Record<AppointmentType, string> = {
  MOT: 'Annual MOT test',
  SERVICE: 'Routine service and inspection',
  MOT_AND_SERVICE: 'MOT test combined with a full service',
  REPAIR: 'Diagnostic and repair work',
  OTHER: "Anything that doesn't fit the categories above",
}

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  BOOKED: 'Booked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
}

export const appointmentStatusClasses: Record<AppointmentStatus, string> = {
  BOOKED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
  NO_SHOW: 'bg-amber-100 text-amber-700',
}
