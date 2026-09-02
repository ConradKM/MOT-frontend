import type { ApiErrorBody } from '../types'
import { ApiError } from './client'
import {
  clearCustomerTokens,
  getCustomerAccessToken,
  getCustomerRefreshToken,
  setCustomerAccessToken,
} from './customerTokens'

// A trimmed sibling of src/api/client.ts's apiFetch for the customer portal.
// Deliberately separate: it reads/writes the customer token keys and refreshes
// against /api/customer/auth/refresh, and never touches the staff client's
// token state or its onAuthFailure redirect.

let refreshPromise: Promise<string | null> | null = null

async function refreshCustomerAccessToken(): Promise<string | null> {
  const refreshToken = getCustomerRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch('/api/customer/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { access_token: string }
    setCustomerAccessToken(data.access_token)
    return data.access_token
  } catch {
    return null
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody
  try {
    body = (await res.json()) as ApiErrorBody
  } catch {
    body = { code: res.status, status: res.statusText }
  }
  return new ApiError(body, `Request failed with status ${res.status}`)
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Skip attaching the customer token / triggering refresh (used for login). */
  skipAuth?: boolean
}

export async function customerApiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options

  const doFetch = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...((headers as Record<string, string> | undefined) ?? {}),
    }
    if (!skipAuth) {
      const token = getCustomerAccessToken()
      if (token) finalHeaders.Authorization = `Bearer ${token}`
    }
    return fetch(path, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await doFetch()

  if (res.status === 401 && !skipAuth) {
    if (!refreshPromise) {
      refreshPromise = refreshCustomerAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (newToken) {
      res = await doFetch()
    } else {
      clearCustomerTokens()
      throw await parseError(res)
    }
  }

  if (!res.ok) {
    throw await parseError(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}
