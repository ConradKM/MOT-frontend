import { useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { BusinessBrandMark } from './BusinessBrandMark'
import { Footer } from './Footer'
import { ImpersonationBanner } from './ImpersonationBanner'
import { NeedHelpMenu } from './NeedHelpMenu'
import { useAuth } from '../auth/AuthContext'
import { useGarage, useUnreadWhatsAppCount } from '../api/queries'
import { useGarageId } from '../hooks/useGarageId'
import { resolveLayoutVariant } from '../lib/layoutVariant'

const NAV_ITEM_CLASS =
  'flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'

const MENU_PANEL_ID = 'staff-nav-menu'

export function Layout() {
  const { logout } = useAuth()
  const { data: garage } = useGarage()
  const { data: unread } = useUnreadWhatsAppCount()
  const garageId = useGarageId()
  const location = useLocation()
  // The phone menu remembers the path it was opened on, so any navigation
  // closes it without an effect - it is only "open" while still on that page.
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null)
  const menuOpen = menuOpenAt === location.pathname
  const closeMenu = () => setMenuOpenAt(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!menuPanelRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) {
        setMenuOpenAt(null)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpenAt(null)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  // Every route under here is /:garageId/... but the garage itself is always derived
  // from the employee's JWT, not the URL - if the id in the URL doesn't match (stale
  // link, hand-edited), send them to the same page under the correct id instead.
  if (garage && garageId !== garage.id) {
    const rest = location.pathname.split('/').slice(2).join('/')
    return <Navigate to={`/${garage.id}/${rest}${location.search}`} replace />
  }

  const navItems: { to: string; label: string; end?: boolean; badge?: number }[] = [
    { to: `/${garageId}/dashboard`, label: 'Dashboard', end: true },
    { to: `/${garageId}/customers`, label: 'Customers' },
    { to: `/${garageId}/appointments`, label: 'Appointments' },
    { to: `/${garageId}/booking-requests`, label: 'Requests' },
    { to: `/${garageId}/queue`, label: 'Queue' },
    { to: `/${garageId}/payments`, label: 'Payments' },
    { to: `/${garageId}/communications`, label: 'Communications', badge: unread?.whatsapp_unread },
    { to: `/${garageId}/settings`, label: 'Settings' },
  ]

  // One set of links, rendered twice: inline from `sm:` up, and in the phone
  // menu panel below it. Which one shows is decided by CSS alone.
  const renderNavLinks = (onNavigate?: () => void) =>
    navItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `${NAV_ITEM_CLASS} ${
            isActive
              ? 'bg-slate-900 font-medium text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`
        }
      >
        {item.label}
        {!!item.badge && (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 px-1 text-xs font-semibold text-white">
            {item.badge}
          </span>
        )}
      </NavLink>
    ))

  const logoutButton = (
    <button
      type="button"
      onClick={logout}
      className={`${NAV_ITEM_CLASS} cursor-pointer text-slate-600 hover:bg-slate-100 hover:text-slate-900`}
    >
      <LogOut className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      Log out
    </button>
  )

  // Shared layout for every tenant. A garage pinned to a registered variant
  // (platform-controlled, set at onboarding) exposes it as a data-attribute /
  // CSS hook - no per-garage branching here or anywhere else.
  return (
    <div className="min-h-screen bg-slate-50" data-layout-variant={resolveLayoutVariant(garage)}>
      {/* Above the header, and sticky, so a support session can never be
          scrolled out of sight. */}
      <ImpersonationBanner />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          {/* The business's own identity, not CoMaz's - this is the app a
              garage's own staff sign into every day. CoMaz stays present,
              just subordinate: the Footer's "Powered by CoMaz OS™" below. */}
          {garage ? (
            <div className="flex min-w-0 items-center gap-2 sm:shrink-0">
              <BusinessBrandMark name={garage.name} logoUrl={garage.logo_url} className="h-8 w-8" />
              <span className="truncate text-sm font-semibold text-slate-900 sm:max-w-40">
                {garage.name}
              </span>
            </div>
          ) : (
            // Same footprint as the mark above, so nothing shifts once the
            // garage query resolves - this is only visible for a beat.
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-slate-100" />
          )}
          {/* Every section stays inline from `sm:` up. If the row is still too
              wide at the narrow end, it scrolls sideways within itself rather
              than pushing the whole page into a horizontal scroll. */}
          <nav
            aria-label="Main"
            className="hidden min-w-0 flex-1 items-center justify-center-safe gap-0.5 overflow-x-auto sm:flex"
          >
            {renderNavLinks()}
          </nav>
          <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
            <NeedHelpMenu />
            {logoutButton}
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpenAt(menuOpen ? null : location.pathname)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? MENU_PANEL_ID : undefined}
            className="ml-auto shrink-0 cursor-pointer rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:hidden"
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
        {menuOpen && (
          <div
            ref={menuPanelRef}
            id={MENU_PANEL_ID}
            className="border-t border-slate-200 px-4 py-2 sm:hidden"
          >
            <nav aria-label="Main menu" className="flex flex-col gap-0.5">
              {renderNavLinks(closeMenu)}
            </nav>
            <div className="mt-2 flex flex-col items-start gap-0.5 border-t border-slate-200 pt-2">
              <NeedHelpMenu />
              {logoutButton}
            </div>
          </div>
        )}
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
