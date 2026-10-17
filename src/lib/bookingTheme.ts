import { MIN_CONTRAST_RATIO, contrastRatio, isHexColor, mixHex } from './contrast'

/**
 * A business's booking-page colours, turned into the CSS custom properties the
 * `page-*` utilities in `src/index.css` read. Only the page background and the
 * text sitting directly on it are themed - cards, form fields, buttons,
 * modals, the Stripe card form and the CAPTCHA keep their own look.
 */
export type BookingThemeVars = Record<
  | '--page-bg'
  | '--page-fg'
  | '--page-strong'
  | '--page-soft'
  | '--page-subtle'
  | '--page-muted'
  | '--page-faint'
  | '--page-border'
  | '--page-control',
  string
>

/** How much of the text colour the secondary (helper / step-label) text starts
 * with, mixed into the background - nudged toward the text colour until it
 * passes contrast in its own right. */
const MUTED_TEXT_WEIGHT = 0.7
const BORDER_WEIGHT = 0.2

/**
 * The theme for a background/text pair, or null for the default look.
 *
 * Never trusts its input (an API payload, a localStorage value): anything
 * other than two valid `#rrggbb` colours with contrast >= 4.5:1 is the
 * default theme, silently.
 */
export function resolveBookingTheme(
  background: string | null | undefined,
  text: string | null | undefined,
): BookingThemeVars | null {
  if (!isHexColor(background) || !isHexColor(text)) return null
  if (contrastRatio(background, text) < MIN_CONTRAST_RATIO) return null

  const bg = background.toLowerCase()
  const fg = text.toLowerCase()
  let weight = MUTED_TEXT_WEIGHT
  let muted = mixHex(fg, bg, weight)
  while (contrastRatio(muted, bg) < MIN_CONTRAST_RATIO && weight < 1) {
    weight = Math.min(1, weight + 0.05)
    muted = mixHex(fg, bg, weight)
  }

  return {
    '--page-bg': bg,
    '--page-fg': fg,
    '--page-strong': fg,
    '--page-soft': fg,
    '--page-subtle': fg,
    '--page-muted': muted,
    '--page-faint': muted,
    '--page-border': mixHex(fg, bg, BORDER_WEIGHT),
    '--page-control': '#ffffff',
  }
}

/** Today's look - what an unset business renders (index.css slate-50 / 800).
 * Shown in the pickers when nothing is saved; never sent as a "custom" pair
 * by Reset, which clears both to null instead. */
export const DEFAULT_BACKGROUND = '#f4f4f4'
export const DEFAULT_TEXT = '#242424'

/** Starting points; every pair passes the 4.5:1 minimum (asserted in bookingTheme.test.ts). */
export const BOOKING_THEME_PRESETS: { name: string; background: string; text: string }[] = [
  { name: 'Midnight', background: '#0b1f3a', text: '#f5f7fa' },
  { name: 'Charcoal', background: '#111827', text: '#f9fafb' },
  { name: 'Cream', background: '#fdf6e3', text: '#3b2f2f' },
  { name: 'Mint', background: '#ecfdf5', text: '#064e3b' },
  { name: 'Lemon', background: '#fefce8', text: '#1e3a8a' },
  { name: 'Black & white', background: '#000000', text: '#ffffff' },
]

export interface BookingColors {
  background: string
  text: string
}

const cacheKey = (garageId: string) => `comaz:booking-theme:${garageId}`

/** The last colours seen for this business, so a repeat visit paints themed
 * from the first frame instead of flashing the default. Re-validated by
 * {@link resolveBookingTheme} like any other input. */
export function readCachedBookingColors(garageId: string): BookingColors | null {
  try {
    const raw = localStorage.getItem(cacheKey(garageId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BookingColors>
    return isHexColor(parsed.background) && isHexColor(parsed.text)
      ? { background: parsed.background, text: parsed.text }
      : null
  } catch {
    return null
  }
}

export function writeCachedBookingColors(garageId: string, colors: BookingColors | null): void {
  try {
    if (colors) localStorage.setItem(cacheKey(garageId), JSON.stringify(colors))
    else localStorage.removeItem(cacheKey(garageId))
  } catch {
    // Storage unavailable (private mode, quota) - first paint just isn't themed.
  }
}
