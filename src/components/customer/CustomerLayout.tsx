import { Link, Outlet } from 'react-router-dom'
import { Footer } from '../Footer'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
import { PLATFORM_NAME } from '../../lib/branding'

export function CustomerLayout() {
  const { isAuthenticated } = useCustomerAuth()

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-sm font-semibold text-slate-900">
            {PLATFORM_NAME}
          </Link>
          <nav className="text-sm font-medium">
            {isAuthenticated ? (
              <Link to="/customer/account" className="text-slate-500 hover:text-slate-800">
                My account
              </Link>
            ) : (
              <Link
                to="/customer/login"
                className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
