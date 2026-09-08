import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { customerPasswordLogin, customerReferenceLogin } from '../api/customerAuth'
import {
  clearCustomerTokens,
  getCustomerAccessToken,
  setCustomerTokens,
} from '../api/customerTokens'
import { decodeJwt } from '../lib/jwt'

interface CustomerAuthContextValue {
  isAuthenticated: boolean
  customerId: string | null
  loginWithReference: (email: string, bookingReference: string) => Promise<void>
  loginWithPassword: (email: string, password: string) => Promise<void>
  logout: () => void
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null)

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => getCustomerAccessToken())

  const loginWithReference = async (email: string, bookingReference: string) => {
    const tokens = await customerReferenceLogin({ email, booking_reference: bookingReference })
    setCustomerTokens(tokens.access_token, tokens.refresh_token)
    setAccessToken(tokens.access_token)
  }

  const loginWithPassword = async (email: string, password: string) => {
    const tokens = await customerPasswordLogin({ email, password })
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
      loginWithReference,
      loginWithPassword,
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
