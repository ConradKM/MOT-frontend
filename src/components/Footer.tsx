import { PLATFORM_TAGLINE } from '../lib/branding'

/** Subtle platform attribution, shared across every layout so it never has
 * to compete visually with a garage's own name/branding. */
export function Footer() {
  return (
    <footer className="py-4 text-center text-xs text-slate-400">{PLATFORM_TAGLINE}</footer>
  )
}
