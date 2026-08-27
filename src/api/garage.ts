import { apiFetch } from './client'
import type { Garage } from '../types'

export function getGarage(): Promise<Garage> {
  return apiFetch<Garage>('/api/garage')
}

export function updateGarage(
  data: Partial<Pick<Garage, 'name' | 'email' | 'phone' | 'address'>>,
): Promise<Garage> {
  return apiFetch<Garage>('/api/garage', { method: 'PATCH', body: data })
}
