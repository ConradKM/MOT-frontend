import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { setOnAuthFailure } from '../api/client'
import { getAccessToken, setTokens, setAccessToken, clearTokens } from '../api/tokens'
import { employeeIdFromToken, impersonationFromToken, type Impersonation } from '../lib/jwt'

interface AuthContextValue {
  isAuthenticated: boolean
  employeeId: string | null
  /** Non-null while this session is a Platform Admin support impersonation. */
  impersonation: Impersonation | null
  login: (email: string, password: string) => Promise<void>
  register: (
    garageName: string,
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>
  /** Begin a Platform Admin support session from an exchanged handoff token.
   *
   * Replaces any existing session, and deliberately stores no refresh token:
   * an impersonation ends at its expiry and cannot be renewed from inside the
   * app. When it lapses, the API client's refresh attempt finds nothing and
   * falls through to the normal sign-in redirect. */
  startImpersonation: (accessToken: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(() => getAccessToken())

  useEffect(() => {
    setOnAuthFailure(() => {
      clearTokens()
      setAccessTokenState(null)
    })
  }, [])

  const applyTokens = (access: string, refresh: string) => {
    setTokens(access, refresh)
    setAccessTokenState(access)
  }

  const login = async (email: string, password: string) => {
    const tokens = await authApi.login({ email, password })
    applyTokens(tokens.access_token, tokens.refresh_token)
  }

  const register = async (
    garageName: string,
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => {
    const tokens = await authApi.registerGarage({
      garage_name: garageName,
      email,
      password,
      first_name: firstName || null,
      last_name: lastName || null,
    })
    applyTokens(tokens.access_token, tokens.refresh_token)
  }

  const startImpersonation = (token: string) => {
    clearTokens()
    setAccessToken(token)
    setAccessTokenState(token)
  }

  const logout = () => {
    clearTokens()
    setAccessTokenState(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!accessToken,
      employeeId: accessToken ? employeeIdFromToken(accessToken) : null,
      impersonation: impersonationFromToken(accessToken),
      login,
      register,
      startImpersonation,
      logout,
    }),
    [accessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
