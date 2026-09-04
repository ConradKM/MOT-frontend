import { apiFetch } from './client'

export type CapacityLevel = 'green' | 'amber' | 'red'

interface CapacityBucket {
  booked: number
  capacity: number
  level: CapacityLevel
}

export interface CapacitySummary {
  today: CapacityBucket & { date: string }
  week: CapacityBucket & { start: string; end: string }
}

export function getCapacitySummary(): Promise<CapacitySummary> {
  return apiFetch<CapacitySummary>('/api/garage/capacity/summary')
}
