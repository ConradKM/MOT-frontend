import { apiFetch } from './client'
import type { Employee } from '../types'

export interface EmployeeInput {
  email: string
  password: string
  first_name?: string | null
  last_name?: string | null
  role_ids?: string[]
}

export interface EmployeeUpdateInput {
  email?: string
  first_name?: string | null
  last_name?: string | null
  role_ids?: string[]
  is_active?: boolean
}

export function listEmployees(): Promise<Employee[]> {
  return apiFetch<Employee[]>('/api/employees/')
}

export function createEmployee(data: EmployeeInput): Promise<Employee> {
  return apiFetch<Employee>('/api/employees/', { method: 'POST', body: data })
}

export function updateEmployee(id: string, data: EmployeeUpdateInput): Promise<Employee> {
  return apiFetch<Employee>(`/api/employees/${id}`, { method: 'PATCH', body: data })
}
