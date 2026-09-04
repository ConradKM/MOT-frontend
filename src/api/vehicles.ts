import { apiFetch } from './client'
import type { Vehicle } from '../types'
import type { DeleteResult } from './customers'

export interface VehicleInput {
  customer_id: string
  registration_number: string
  make?: string | null
  model?: string | null
  year?: number | null
  current_mileage?: number | null
  mot_expiry_date?: string | null
}

export interface VehicleListParams {
  registration?: string
  customer_id?: string
  mot_expiry_date?: string
  /** See CustomerListParams.include_inactive - same idea. */
  include_inactive?: boolean
}

export function listVehicles(params: VehicleListParams = {}): Promise<Vehicle[]> {
  const qs = new URLSearchParams()
  if (params.registration) qs.set('registration', params.registration)
  if (params.customer_id !== undefined) qs.set('customer_id', params.customer_id)
  if (params.mot_expiry_date) qs.set('mot_expiry_date', params.mot_expiry_date)
  if (params.include_inactive) qs.set('include_inactive', 'true')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<Vehicle[]>(`/api/vehicles/${suffix}`)
}

export function getVehicle(id: string): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/api/vehicles/${id}`)
}

export function createVehicle(data: VehicleInput): Promise<Vehicle> {
  return apiFetch<Vehicle>('/api/vehicles/', { method: 'POST', body: data })
}

export function updateVehicle(id: string, data: Partial<VehicleInput>): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/api/vehicles/${id}`, { method: 'PATCH', body: data })
}

export function deleteVehicle(id: string): Promise<DeleteResult> {
  return apiFetch<DeleteResult>(`/api/vehicles/${id}`, { method: 'DELETE' })
}
