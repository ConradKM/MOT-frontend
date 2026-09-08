import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { render, type RenderOptions } from '@testing-library/react'
import { AuthProvider } from '../auth/AuthContext'
import { CustomerAuthProvider } from '../auth/CustomerAuthContext'
import { ToastProvider } from '../components/Toast'
import { setCustomerTokens } from '../api/customerTokens'
import { setTokens } from '../api/tokens'
import { makeJwt } from './fixtures'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  queryClient?: QueryClient
}

/** Render a component inside a fresh QueryClient + MemoryRouter. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient = makeQueryClient(), ...options }: Options = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}

/**
 * Render inside the *same* provider stack `src/main.tsx` mounts — query client,
 * router, toasts and both auth contexts. Use this for routing/auth integration
 * tests, where a component's behaviour depends on a provider it doesn't import
 * directly; `renderWithProviders` stays the cheaper choice for a single
 * component.
 */
export function renderWithAppProviders(
  ui: ReactElement,
  { route = '/', queryClient = makeQueryClient(), ...options }: Options = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <ToastProvider>
            <AuthProvider>
              <CustomerAuthProvider>{children}</CustomerAuthProvider>
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}

/**
 * Seed a staff session before rendering. Must run *before* the render — both
 * auth contexts read localStorage once, in a `useState` initialiser.
 */
export function signInAsStaff(employeeId = 'e1'): void {
  setTokens(makeJwt(employeeId), makeJwt(employeeId))
}

/** Seed a customer-portal session. Same before-render rule as `signInAsStaff`. */
export function signInAsCustomer(customerId = 'c1'): void {
  setCustomerTokens(makeJwt(customerId), makeJwt(customerId))
}
