import { apiFetch } from './client'
import type { MOTRecord } from '../types'

export interface MOTRecordInput {
  mot_date: string
  expiry_date: string
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
