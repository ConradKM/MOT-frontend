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
