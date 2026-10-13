import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { resolveBookingTheme } from '../../lib/bookingTheme'
import { BookingThemedContext } from './bookingThemeContext'

interface Props {
  /** The business's page background, `#rrggbb`, or null for the default. */
  background: string | null | undefined
  /** The business's page text colour, `#rrggbb`, or null for the default. */
  text: string | null | undefined
  className?: string
  children: ReactNode
}

/**
 * Applies a business's booking-page colours to everything inside it, through
 * the `--page-*` CSS variables the `page-*` utilities read (src/index.css).
 *
 * Both colours are re-validated here - strict `#rrggbb` and contrast >= 4.5:1
 * - and anything else silently renders the default look, so a bad API payload
 * or cached value can never reach the page. Values are only ever set as custom
 * properties through the `style` prop; never interpolated into a class name or
 * stylesheet.
 *
 * Used by CustomerLayout (every customer-facing page) and by the settings
 * page's live preview, so the preview cannot diverge from the real page.
 */
export function BookingThemeScope({ background, text, className = '', children }: Props) {
  const theme = useMemo(() => resolveBookingTheme(background, text), [background, text])

  return (
    <BookingThemedContext.Provider value={theme !== null}>
      <div
        data-booking-theme={theme ? 'custom' : 'default'}
        style={theme ? (theme as CSSProperties) : undefined}
        className={`bg-page text-page-fg transition-colors duration-300 motion-reduce:transition-none ${className}`}
      >
        {children}
      </div>
    </BookingThemedContext.Provider>
  )
}
