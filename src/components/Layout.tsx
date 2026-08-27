import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useGarage } from '../api/queries'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/customers', label: 'Customers' },
  { to: '/vehicles', label: 'Vehicles' },
  { to: '/appointments', label: 'Appointments' },
  { to: '/garage', label: 'Garage Settings' },
]

export function Layout() {
  const { logout } = useAuth()
  const { data: garage } = useGarage()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-center gap-8">
            <p className="shrink-0 text-sm font-semibold text-slate-900">
              {garage?.name ?? 'MOT Garage'}
            </p>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <button
            onClick={logout}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Log out
          </button>
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
