import { apiFetch } from './client'
import type { Customer } from '../types'

export interface CustomerInput {
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
}

export function listCustomers(params: { search?: string } = {}): Promise<Customer[]> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<Customer[]>(`/api/customers/${suffix}`)
}

export function getCustomer(id: number): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`)
}

export function createCustomer(data: CustomerInput): Promise<Customer> {
  return apiFetch<Customer>('/api/customers/', { method: 'POST', body: data })
}

export function updateCustomer(id: number, data: Partial<CustomerInput>): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`, { method: 'PATCH', body: data })
}

export function deleteCustomer(id: number): Promise<void> {
  return apiFetch<void>(`/api/customers/${id}`, { method: 'DELETE' })
}
