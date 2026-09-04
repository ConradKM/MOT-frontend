import { apiFetch } from './client'
import type { Garage } from '../types'

/**
 * The caller's garage. Business details are **read-only** for garage users -
 * there is no updateGarage(): `PATCH /api/garage` returns 403. The platform
 * changes a tenant's details with the `flask update-garage-details` CLI.
 */
export function getGarage(): Promise<Garage> {
  return apiFetch<Garage>('/api/garage')
}
