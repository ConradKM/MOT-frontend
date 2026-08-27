import { apiFetch } from './client'

export interface TokenPair {
  access_token: string
  refresh_token: string
}

export function registerGarage(data: {
  garage_name: string
  email: string
  password: string
}): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/register', { method: 'POST', body: data, skipAuth: true })
}

export function login(data: { email: string; password: string }): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/login', { method: 'POST', body: data, skipAuth: true })
}
