import { apiFetch } from './client'
import type { Customer } from '../types'

export interface CustomerInput {
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
}

export interface CustomerListParams {
  search?: string
  /** Also return archived (soft-deleted) customers. Default false - the
   * normal list hides them; a customer's own detail page passes true so it
   * stays reachable after being archived. */
  include_inactive?: boolean
}

export interface DeleteResult {
  /** True if the record had history and was archived instead of removed. */
  archived: boolean
  deleted: boolean
}

export function listCustomers(params: CustomerListParams = {}): Promise<Customer[]> {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.include_inactive) qs.set('include_inactive', 'true')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<Customer[]>(`/api/customers/${suffix}`)
}

export function getCustomer(id: string): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`)
}

export function createCustomer(data: CustomerInput): Promise<Customer> {
  return apiFetch<Customer>('/api/customers/', { method: 'POST', body: data })
}

export function updateCustomer(id: string, data: Partial<CustomerInput>): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`, { method: 'PATCH', body: data })
}

export function deleteCustomer(id: string): Promise<DeleteResult> {
  return apiFetch<DeleteResult>(`/api/customers/${id}`, { method: 'DELETE' })
}
