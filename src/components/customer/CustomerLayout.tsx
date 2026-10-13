import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { Footer } from '../Footer'
import { usePublicGarage } from '../../api/queries'
import { termsPath } from '../../lib/bookingUrl'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
import { PLATFORM_NAME } from '../../lib/branding'
import {
  readCachedBookingColors,
  resolveBookingTheme,
  writeCachedBookingColors,
} from '../../lib/bookingTheme'
import { BookingThemeScope } from './BookingThemeScope'
import { ThemeGarageReporterContext, useIsBookingThemed } from './bookingThemeContext'

export function CustomerLayout() {
  // Every business-specific public page (/book, /queue, /terms,
  // /accept-terms) carries :garageId. The page itself loads the same public
  // garage, so this is a cache hit rather than a second request. The customer
  // portal has no :garageId in its URLs; its pages report the business from
  // their own data instead (useReportThemeGarage). Bare /book has neither and
  // stays on the default look.
  const { garageId: routeGarageId } = useParams<{ garageId: string }>()
  const [reportedGarageId, setReportedGarageId] = useState<string | undefined>()
  const garageId = routeGarageId ?? reportedGarageId
  const { data: garage } = usePublicGarage(garageId)
  const termsHref =
    routeGarageId && garage?.terms_and_conditions?.trim() ? termsPath(routeGarageId) : null

  // Until the garage loads: the colours this browser last saw for it (so a
  // repeat visit is themed from the first frame), else the default look.
  const cached = useMemo(() => (garageId ? readCachedBookingColors(garageId) : null), [garageId])
  const background = garage ? garage.booking_background_color : cached?.background
  const text = garage ? garage.booking_text_color : cached?.text

  useEffect(() => {
    if (!garageId || !garage) return
    const { booking_background_color: bg, booking_text_color: fg } = garage
    writeCachedBookingColors(
      garageId,
      bg && fg && resolveBookingTheme(bg, fg) ? { background: bg, text: fg } : null,
    )
  }, [garageId, garage])

  return (
    <ThemeGarageReporterContext.Provider value={setReportedGarageId}>
      <BookingThemeScope
        background={background}
        text={text}
        className="flex min-h-screen flex-col"
      >
        <CustomerHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
          <Outlet />
        </main>
        <Footer termsHref={termsHref} />
      </BookingThemeScope>
    </ThemeGarageReporterContext.Provider>
  )
}

/** White bar by default; on a business's own colours it becomes part of the
 * page (no background of its own, themed text and divider) so a dark page
 * isn't topped by a stark white strip. The Sign In button keeps its look. */
function CustomerHeader() {
  const { isAuthenticated } = useCustomerAuth()
  const themed = useIsBookingThemed()

  return (
    <header className={themed ? 'border-b border-page-border' : 'border-b border-slate-200 bg-white'}>
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className={`text-sm font-semibold ${themed ? 'text-page-strong' : 'text-slate-900'}`}
        >
          {PLATFORM_NAME}
        </Link>
        <nav className="text-sm font-medium">
          {isAuthenticated ? (
            <Link
              to="/customer/account"
              className={
                themed
                  ? 'text-page-muted hover:text-page-fg'
                  : 'text-slate-500 hover:text-slate-800'
              }
            >
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
  )
}
