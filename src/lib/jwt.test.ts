import { describe, expect, it } from 'vitest'
import { decodeJwt, employeeIdFromToken, impersonationFromToken } from './jwt'
import { makeJwt } from '../test/fixtures'

describe('decodeJwt', () => {
  it('reads the claims out of a well-formed token', () => {
    const payload = decodeJwt(makeJwt('e42', { exp: 1_800_000_000 }))
    expect(payload).toMatchObject({ sub: 'e42', exp: 1_800_000_000 })
  })

  it('decodes a payload that uses base64url characters', () => {
    // "-" and "_" replace "+" and "/" in base64url; a naive atob would throw.
    const token = makeJwt('sub-with-ünïcodé~+/chars')
    expect(decodeJwt(token)?.sub).toBe('sub-with-ünïcodé~+/chars')
  })

  it('returns null rather than throwing for malformed input', () => {
    // The token comes from localStorage, which a user can edit — a crash here
    // would white-screen the whole app on boot.
    expect(decodeJwt('')).toBeNull()
    expect(decodeJwt('not-a-jwt')).toBeNull()
    expect(decodeJwt('a.!!!notbase64!!!.c')).toBeNull()
    expect(decodeJwt(`a.${btoa('not json')}.c`)).toBeNull()
  })
})

describe('employeeIdFromToken', () => {
  it('extracts the subject claim', () => {
    expect(employeeIdFromToken(makeJwt('e7'))).toBe('e7')
  })

  it('returns null when there is no usable subject', () => {
    expect(employeeIdFromToken(makeJwt(''))).toBeNull()
    expect(employeeIdFromToken('garbage')).toBeNull()
  })
})

describe('impersonationFromToken', () => {
  it('returns null for an ordinary staff token', () => {
    expect(impersonationFromToken(makeJwt('e1'))).toBeNull()
  })

  it('returns null for no token at all', () => {
    expect(impersonationFromToken(null)).toBeNull()
  })

  it('reads the session, administrator and expiry from the claims', () => {
    const token = makeJwt('e1', {
      impersonation_id: 'sess-1',
      impersonated_by_email: 'ops@comaz.example',
      exp: 1893456000,
    })

    expect(impersonationFromToken(token)).toEqual({
      sessionId: 'sess-1',
      adminEmail: 'ops@comaz.example',
      expiresAt: 1893456000,
    })
  })

  it('still reports the session when the administrator email is absent', () => {
    const token = makeJwt('e1', { impersonation_id: 'sess-1' })

    expect(impersonationFromToken(token)).toEqual({
      sessionId: 'sess-1',
      adminEmail: null,
      expiresAt: null,
    })
  })

  it('ignores a malformed token rather than throwing', () => {
    expect(impersonationFromToken('not-a-jwt')).toBeNull()
  })
})
