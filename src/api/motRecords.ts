import { apiFetch } from './client'
import type { MOTRecord } from '../types'

export interface MOTRecordInput {
  mot_date: string
  expiry_date: string
  result: MOTRecord['result']
  notes?: string | null
}

export function listMOTRecords(vehicleId: number): Promise<MOTRecord[]> {
  return apiFetch<MOTRecord[]>(`/api/vehicles/${vehicleId}/mot-records/`)
}

export function createMOTRecord(vehicleId: number, data: MOTRecordInput): Promise<MOTRecord> {
  return apiFetch<MOTRecord>(`/api/vehicles/${vehicleId}/mot-records/`, {
    method: 'POST',
    body: data,
  })
}

export function updateMOTRecord(
  vehicleId: number,
  id: number,
  data: Partial<MOTRecordInput>,
): Promise<MOTRecord> {
  return apiFetch<MOTRecord>(`/api/vehicles/${vehicleId}/mot-records/${id}`, {
    method: 'PATCH',
    body: data,
  })
}
