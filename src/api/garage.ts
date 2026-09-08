import { apiFetch } from './client'
import type { Garage } from '../types'

/** The caller's own business record. */
export function getGarage(): Promise<Garage> {
  return apiFetch<Garage>('/api/garage')
}

/**
 * The subset of business fields an OWNER may edit (`PATCH /api/garage`). The
 * backend allowlist is exactly these six; `slug`, `id`, `layout_variant` and
 * every system field are rejected. STAFF get 403.
 */
export type GarageDetailsPatch = Partial<
  Pick<Garage, 'name' | 'email' | 'phone' | 'address' | 'postcode' | 'website'>
>

export function updateGarage(patch: GarageDetailsPatch): Promise<Garage> {
  return apiFetch<Garage>('/api/garage', { method: 'PATCH', body: patch })
}
