import { apiFetch } from './client'
import type { Role } from '../types'

export function listRoles(): Promise<Role[]> {
  return apiFetch<Role[]>('/api/roles/')
}

export function createRole(name: string): Promise<Role> {
  return apiFetch<Role>('/api/roles/', { method: 'POST', body: { name } })
}

export function updateRole(id: string, name: string): Promise<Role> {
  return apiFetch<Role>(`/api/roles/${id}`, { method: 'PATCH', body: { name } })
}

export function deleteRole(id: string): Promise<void> {
  return apiFetch<void>(`/api/roles/${id}`, { method: 'DELETE' })
}
