import { Link, Outlet } from 'react-router-dom'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'

export function CustomerLayout() {
  const { isAuthenticated } = useCustomerAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm font-semibold text-slate-900">
            MOT Garage
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              to={isAuthenticated ? '/customer/account' : '/customer/login'}
              className="text-slate-500 hover:text-slate-800"
            >
              {isAuthenticated ? 'My account' : 'Customer sign in'}
            </Link>
            <Link to="/login" className="text-slate-500 hover:text-slate-800">
              Garage staff sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
