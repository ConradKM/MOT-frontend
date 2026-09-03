import type { GarageAppointmentStatus } from '../types'
import {
  APPOINTMENT_STATUSES,
  appointmentStatusClasses,
  appointmentStatusLabels,
} from './appointments'

// Colour token -> Tailwind badge classes. Listed as literals so Tailwind's
// scanner keeps them in the build.
const COLOR_CLASSES: Record<string, string> = {
  violet: 'bg-violet-100 text-violet-700',
  blue: 'bg-blue-100 text-blue-700',
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-500',
  amber: 'bg-amber-100 text-amber-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  pink: 'bg-pink-100 text-pink-700',
  grey: 'bg-slate-100 text-slate-600',
  gray: 'bg-slate-100 text-slate-600',
}
const FALLBACK_CLASS = 'bg-slate-100 text-slate-600'

export const STATUS_COLORS = Object.keys(COLOR_CLASSES).filter(
  (c) => c !== 'gray',
)

export type StatusConfig = GarageAppointmentStatus[] | undefined

export function statusLabel(config: StatusConfig, key: string): string {
  const found = config?.find((s) => s.key === key)
  if (found) return found.label
  return appointmentStatusLabels[key as keyof typeof appointmentStatusLabels] ?? key
}

export function statusBadgeClass(config: StatusConfig, key: string): string {
  const found = config?.find((s) => s.key === key)
  if (found) return COLOR_CLASSES[found.color] ?? FALLBACK_CLASS
  return (
    appointmentStatusClasses[key as keyof typeof appointmentStatusClasses] ?? FALLBACK_CLASS
  )
}

/** Ordered {key,label} options for a status picker — the garage's config, or
 * the built-in list when it hasn't configured any. */
export function statusOptions(config: StatusConfig): { key: string; label: string }[] {
  if (config && config.length > 0) {
    return [...config]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ key: s.key, label: s.label }))
  }
  return APPOINTMENT_STATUSES.map((k) => ({
    key: k,
    label: appointmentStatusLabels[k as keyof typeof appointmentStatusLabels] ?? k,
  }))
}
