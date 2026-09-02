import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { customerLogin } from '../api/customerAuth'
import {
  clearCustomerTokens,
  getCustomerAccessToken,
  setCustomerTokens,
} from '../api/customerTokens'
import { decodeJwt } from '../lib/jwt'

interface CustomerAuthContextValue {
  isAuthenticated: boolean
  customerId: string | null
  login: (email: string, registrationNumber: string) => Promise<void>
  logout: () => void
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null)

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => getCustomerAccessToken())

  const login = async (email: string, registrationNumber: string) => {
    const tokens = await customerLogin({ email, registration_number: registrationNumber })
    setCustomerTokens(tokens.access_token, tokens.refresh_token)
    setAccessToken(tokens.access_token)
  }

  const logout = () => {
    clearCustomerTokens()
    setAccessToken(null)
  }

  const value = useMemo<CustomerAuthContextValue>(() => {
    const sub = accessToken ? decodeJwt(accessToken)?.sub : undefined
    return {
      isAuthenticated: !!accessToken,
      customerId: typeof sub === 'string' && sub.length > 0 ? sub : null,
      login,
      logout,
    }
  }, [accessToken])

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider')
  return ctx
}
