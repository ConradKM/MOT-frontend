import type { ApiErrorBody } from '../types'
import { API_BASE_URL } from './config'
import { getAccessToken, getRefreshToken, setAccessToken, clearTokens } from './tokens'

export class ApiError extends Error {
  code: number
  status: string
  fieldErrors?: Record<string, string[]>

  constructor(body: ApiErrorBody, fallbackMessage: string) {
    super(body.message ?? body.msg ?? fallbackMessage)
    this.code = body.code
    this.status = body.status
    this.fieldErrors = body.errors?.json ?? body.errors?.query
  }
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { access_token: string }
    setAccessToken(data.access_token)
    return data.access_token
  } catch {
    return null
  }
}

let onAuthFailure = () => {
  clearTokens()
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

/** Allows the app to customize what happens when refresh fails (e.g. clear React auth state). */
export function setOnAuthFailure(handler: () => void): void {
  onAuthFailure = handler
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  /** Skip attaching the access token / triggering refresh (used for login/register). */
  skipAuth?: boolean
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

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options

  const doFetch = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...((headers as Record<string, string> | undefined) ?? {}),
    }
    if (!skipAuth) {
      const token = getAccessToken()
      if (token) finalHeaders.Authorization = `Bearer ${token}`
    }
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await doFetch()

  if (res.status === 401 && !skipAuth) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (newToken) {
      res = await doFetch()
    } else {
      onAuthFailure()
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
