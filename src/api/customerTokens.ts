// Customer-portal tokens, kept under their own keys so a customer session and a
// garage-staff session (src/api/tokens.ts) can coexist in the same browser
// without clobbering each other.
const ACCESS_KEY = 'mot_customer_access_token'
const REFRESH_KEY = 'mot_customer_refresh_token'

export function getCustomerAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getCustomerRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setCustomerTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function setCustomerAccessToken(access: string): void {
  localStorage.setItem(ACCESS_KEY, access)
}

export function clearCustomerTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
