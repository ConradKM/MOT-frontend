import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Footer } from './Footer'
import { useAuth } from '../auth/AuthContext'
import { useGarage } from '../api/queries'
import { useGarageId } from '../hooks/useGarageId'
import { resolveLayoutVariant } from '../lib/layoutVariant'
import { PLATFORM_NAME } from '../lib/branding'

export function Layout() {
  const { logout } = useAuth()
  const { data: garage } = useGarage()
  const garageId = useGarageId()
  const location = useLocation()

  // Every route under here is /:garageId/... but the garage itself is always derived
  // from the employee's JWT, not the URL - if the id in the URL doesn't match (stale
  // link, hand-edited), send them to the same page under the correct id instead.
  if (garage && garageId !== garage.id) {
    const rest = location.pathname.split('/').slice(2).join('/')
    return <Navigate to={`/${garage.id}/${rest}${location.search}`} replace />
  }

  const navItems = [
    { to: `/${garageId}/dashboard`, label: 'Dashboard', end: true },
    { to: `/${garageId}/customers`, label: 'Customers' },
    { to: `/${garageId}/appointments`, label: 'Appointments' },
    { to: `/${garageId}/booking-requests`, label: 'Requests' },
    { to: `/${garageId}/settings`, label: 'Settings' },
  ]

  // Shared layout for every tenant. A garage pinned to a registered variant
  // (platform-controlled, set at onboarding) exposes it as a data-attribute /
  // CSS hook - no per-garage branching here or anywhere else.
  return (
    <div className="min-h-screen bg-slate-50" data-layout-variant={resolveLayoutVariant(garage)}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-center gap-8">
            <p className="shrink-0 text-sm font-semibold text-slate-900">
              {garage?.name ?? PLATFORM_NAME}
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
      <Footer />
    </div>
  )
}
