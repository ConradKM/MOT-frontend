/**
 * WCAG colour contrast for the booking-page colours (page background + page
 * text). Mirrors MOT-backend `app/garages/appearance.py`, which is the
 * authority (it 422s a failing pair); both test suites run the same vector
 * table (`contrastVectors.json`) so the two implementations cannot drift.
 */

/** WCAG 2.x contrast for normal-size text, level AA. */
export const MIN_CONTRAST_RATIO = 4.5

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Strict `#rrggbb` only - no 3-digit shorthand, alpha, names or `rgb()`.
 * This is the injection guard: only a value that passes is ever written into
 * a CSS custom property. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value)
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of a `#rrggbb` colour (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two `#rrggbb` colours, 1 - 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * `weight` of `a` mixed into `b`, per channel in gamma-encoded sRGB - the same
 * result as CSS `color-mix(in srgb, a weight%, b)`, but as a hex value whose
 * contrast can be checked before it is used.
 */
export function mixHex(a: string, b: string, weight: number): string {
  const ca = rgb(a)
  const cb = rgb(b)
  return `#${ca
    .map((v, i) => Math.round(v * weight + cb[i] * (1 - weight)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

/** The ratio rounded *down* to one decimal, for display - so a pair shown
 * as "4.5:1" can never be one the server rejects at 4.48. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`
}
