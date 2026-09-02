import { Navigate, Outlet } from 'react-router-dom'
import { useCustomerAuth } from '../auth/CustomerAuthContext'

export function CustomerProtectedRoute() {
  const { isAuthenticated } = useCustomerAuth()
  if (!isAuthenticated) return <Navigate to="/customer/login" replace />
  return <Outlet />
}
