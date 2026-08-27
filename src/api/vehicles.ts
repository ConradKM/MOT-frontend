import { apiFetch } from './client'
import type { Vehicle } from '../types'

export interface VehicleInput {
  customer_id: number
  registration_number: string
  make?: string | null
  model?: string | null
  year?: number | null
  current_mileage?: number | null
  mot_expiry_date?: string | null
}

export interface VehicleListParams {
  registration?: string
  customer_id?: number
  mot_expiry_date?: string
}

export function listVehicles(params: VehicleListParams = {}): Promise<Vehicle[]> {
  const qs = new URLSearchParams()
  if (params.registration) qs.set('registration', params.registration)
  if (params.customer_id !== undefined) qs.set('customer_id', String(params.customer_id))
  if (params.mot_expiry_date) qs.set('mot_expiry_date', params.mot_expiry_date)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<Vehicle[]>(`/api/vehicles/${suffix}`)
}

export function getVehicle(id: number): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/api/vehicles/${id}`)
}

export function createVehicle(data: VehicleInput): Promise<Vehicle> {
  return apiFetch<Vehicle>('/api/vehicles/', { method: 'POST', body: data })
}

export function updateVehicle(id: number, data: Partial<VehicleInput>): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/api/vehicles/${id}`, { method: 'PATCH', body: data })
}

export function deleteVehicle(id: number): Promise<void> {
  return apiFetch<void>(`/api/vehicles/${id}`, { method: 'DELETE' })
}
