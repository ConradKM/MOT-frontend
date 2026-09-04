import { apiFetch } from './client'
import type { MOTRecord } from '../types'

export interface MOTRecordInput {
  mot_date: string
  // Optional: a FAIL doesn't need one - the backend defaults it to mot_date
  // itself (no forward validity granted). Effectively required for PASS.
  expiry_date?: string | null
  result: MOTRecord['result']
  notes?: string | null
}

export function listMOTRecords(vehicleId: string): Promise<MOTRecord[]> {
  return apiFetch<MOTRecord[]>(`/api/vehicles/${vehicleId}/mot-records/`)
}

export function createMOTRecord(vehicleId: string, data: MOTRecordInput): Promise<MOTRecord> {
  return apiFetch<MOTRecord>(`/api/vehicles/${vehicleId}/mot-records/`, {
    method: 'POST',
    body: data,
  })
}

export function updateMOTRecord(
  vehicleId: string,
  id: string,
  data: Partial<MOTRecordInput>,
): Promise<MOTRecord> {
  return apiFetch<MOTRecord>(`/api/vehicles/${vehicleId}/mot-records/${id}`, {
    method: 'PATCH',
    body: data,
  })
}
