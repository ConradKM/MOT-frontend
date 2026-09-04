import { apiFetch } from './client'

export type CapacityLevel = 'green' | 'amber' | 'red'

interface CapacityBucket {
  /** Minutes of scheduling time actually booked - not a count of appointment
   * rows, since durations vary (see the backend's app/garages/capacity.py). */
  booked_minutes: number
  /** Minutes of scheduling time available (open minutes x resource count). */
  capacity_minutes: number
  level: CapacityLevel
}

export interface CapacitySummary {
  today: CapacityBucket & { date: string }
  week: CapacityBucket & { start: string; end: string }
}

export function getCapacitySummary(): Promise<CapacitySummary> {
  return apiFetch<CapacitySummary>('/api/garage/capacity/summary')
}
