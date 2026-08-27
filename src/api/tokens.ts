const ACCESS_KEY = 'mot_access_token'
const REFRESH_KEY = 'mot_refresh_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function setAccessToken(access: string): void {
  localStorage.setItem(ACCESS_KEY, access)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
