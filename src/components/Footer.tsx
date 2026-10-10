import { Link } from 'react-router-dom'
import { PLATFORM_TAGLINE } from '../lib/branding'

/** Subtle platform attribution, shared across every layout so it never has
 * to compete visually with a garage's own name/branding. The customer-facing
 * layout also passes the business's Terms & Conditions page, when it has
 * one; the staff and sign-in layouts never do. */
export function Footer({ termsHref }: { termsHref?: string | null } = {}) {
  return (
    <footer className="py-4 text-center text-xs text-slate-400">
      {termsHref && (
        <>
          <Link to={termsHref} className="text-slate-500 underline hover:text-slate-700">
            Terms &amp; Conditions
          </Link>
          <span aria-hidden="true"> · </span>
        </>
      )}
      {PLATFORM_TAGLINE}
    </footer>
  )
}
