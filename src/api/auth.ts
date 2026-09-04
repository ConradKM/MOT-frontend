import { apiFetch } from './client'

export interface TokenPair {
  access_token: string
  refresh_token: string
}

export function registerGarage(data: {
  garage_name: string
  email: string
  password: string
  first_name?: string | null
  last_name?: string | null
}): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/register', { method: 'POST', body: data, skipAuth: true })
}

export function login(data: { email: string; password: string }): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/login', { method: 'POST', body: data, skipAuth: true })
}

/** Always resolves with the same generic message — never reveals whether the
 * email is registered. */
export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
    skipAuth: true,
  })
}

/** True if the reset token is still valid (not used / not expired). */
export async function checkResetToken(token: string): Promise<boolean> {
  try {
    const res = await apiFetch<{ valid: boolean }>(
      `/api/auth/reset-password?token=${encodeURIComponent(token)}`,
      { skipAuth: true },
    )
    return res.valid === true
  } catch {
    return false
  }
}

export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password },
    skipAuth: true,
  })
}
