import { createContext, useContext, useEffect } from 'react'

/** Whether the nearest BookingThemeScope is applying a business's colours
 * (false = the default look). */
export const BookingThemedContext = createContext(false)

export function useIsBookingThemed(): boolean {
  return useContext(BookingThemedContext)
}

/**
 * How a customer page whose URL carries no `:garageId` (the customer portal)
 * tells CustomerLayout which business it belongs to, so the layout can apply
 * that business's colours. Null outside CustomerLayout.
 */
export const ThemeGarageReporterContext = createContext<((garageId: string | undefined) => void) | null>(
  null,
)

/** Report the business this page belongs to (from its own data) for theming. */
export function useReportThemeGarage(garageId: string | undefined): void {
  const report = useContext(ThemeGarageReporterContext)
  useEffect(() => {
    if (!report) return
    report(garageId)
    return () => report(undefined)
  }, [report, garageId])
}
