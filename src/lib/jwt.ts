interface JwtPayload {
  sub?: string
  exp?: number
  [key: string]: unknown
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function employeeIdFromToken(token: string): string | null {
  const payload = decodeJwt(token)
  const sub = payload?.sub
  return typeof sub === 'string' && sub.length > 0 ? sub : null
}

/** The Platform Admin support session behind an impersonation token, if this
 * token is one. Read from the access token's own claims, which the backend
 * sets when a support handoff is exchanged (see the backend's
 * app/platform_admin/impersonation.py).
 *
 * Display only. Nothing here is a security decision — the backend re-checks
 * the session on every request and cuts the token off the moment it is revoked
 * or expires. This exists so the person using the app can always see that
 * someone else is driving it. */
export interface Impersonation {
  sessionId: string
  adminEmail: string | null
  /** Unix seconds — the hard end of the session; it cannot be refreshed. */
  expiresAt: number | null
}

export function impersonationFromToken(token: string | null): Impersonation | null {
  if (!token) return null

  const payload = decodeJwt(token)
  const sessionId = payload?.impersonation_id
  if (typeof sessionId !== 'string' || sessionId.length === 0) return null

  const adminEmail = payload?.impersonated_by_email
  return {
    sessionId,
    adminEmail: typeof adminEmail === 'string' ? adminEmail : null,
    expiresAt: typeof payload?.exp === 'number' ? payload.exp : null,
  }
}
