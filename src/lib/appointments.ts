import type { AppointmentStatus } from '../types'

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'REQUESTED',
  'BOOKED',
  'IN_PROGRESS',
  'COMPLETED',
  'ACTION_NEEDED',
  'CANCELLED',
  'NO_SHOW',
]

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  REQUESTED: 'Requested',
  BOOKED: 'Booked',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  ACTION_NEEDED: 'Action needed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
}

export const appointmentStatusClasses: Record<AppointmentStatus, string> = {
  REQUESTED: 'bg-violet-100 text-violet-700',
  BOOKED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-sky-100 text-sky-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  ACTION_NEEDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
  NO_SHOW: 'bg-amber-100 text-amber-700',
}
