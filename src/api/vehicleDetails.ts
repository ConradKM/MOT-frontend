import { apiFetch } from './client'

/**
 * Booking Workflow › Vehicle details - ask customers for registration, make
 * and model. A switch over ordinary bound fields in the default workflow
 * (GET/PUT /api/booking-flow/vehicle-details), so the rest of the Booking
 * Workflow editor shows and edits the same fields.
 */

export type VehicleDetailKey = 'registration' | 'make' | 'model'

export interface VehicleDetailState {
  enabled: boolean
  required: boolean
}

export interface VehicleDetails {
  fields: Record<VehicleDetailKey, VehicleDetailState>
  services_with_own_workflow: number
}

export function getVehicleDetails(): Promise<VehicleDetails> {
  return apiFetch('/api/booking-flow/vehicle-details')
}

export function updateVehicleDetails(
  fields: Partial<Record<VehicleDetailKey, VehicleDetailState>>,
): Promise<VehicleDetails> {
  return apiFetch('/api/booking-flow/vehicle-details', { method: 'PUT', body: fields })
}
