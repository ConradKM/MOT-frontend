import type { AppointmentStatus, AppointmentType } from '../types'

export const appointmentTypeLabels: Record<AppointmentType, string> = {
  MOT: 'MOT',
  SERVICE: 'Service',
  MOT_AND_SERVICE: 'MOT + Service',
  REPAIR: 'Repair',
  OTHER: 'Other',
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
