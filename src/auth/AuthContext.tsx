import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { setOnAuthFailure } from '../api/client'
import { getAccessToken, setTokens, clearTokens } from '../api/tokens'
import { employeeIdFromToken } from '../lib/jwt'

interface AuthContextValue {
  isAuthenticated: boolean
  employeeId: number | null
  login: (email: string, password: string) => Promise<void>
  register: (garageName: string, email: string, password: string) => Promise<void>
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

  const register = async (garageName: string, email: string, password: string) => {
    const tokens = await authApi.registerGarage({ garage_name: garageName, email, password })
    applyTokens(tokens.access_token, tokens.refresh_token)
  }

  const logout = () => {
    clearTokens()
    setAccessTokenState(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!accessToken,
      employeeId: accessToken ? employeeIdFromToken(accessToken) : null,
      login,
      register,
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
