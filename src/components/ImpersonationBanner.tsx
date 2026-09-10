import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { PLATFORM_NAME } from '../lib/branding'

function remaining(expiresAt: number | null, now: number): string | null {
  if (expiresAt === null) return null

  const seconds = Math.max(0, expiresAt - Math.floor(now / 1000))
  if (seconds === 0) return 'expired'

  const minutes = Math.floor(seconds / 60)
  if (minutes >= 1) return `${minutes}m ${seconds % 60}s left`
  return `${seconds}s left`
}

/**
 * Persistent, unmissable notice that this session is a {PLATFORM_NAME} support
 * impersonation rather than a real sign-in.
 *
 * Requirement, not decoration: whoever is looking at this screen must be able
 * to tell at a glance that someone from the platform team is driving it, who
 * they are, and how long the session has left. It is rendered outside the
 * page's scroll area so it can't be scrolled away, and the countdown is live
 * so an expiring session is visibly expiring.
 *
 * Display only — the backend independently re-checks the session on every
 * request and refuses the token the moment it is revoked or expires.
 */
export function ImpersonationBanner() {
  const { impersonation } = useAuth()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!impersonation) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [impersonation])

  if (!impersonation) return null

  const left = remaining(impersonation.expiresAt, now)

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 border-b border-amber-500 bg-amber-400 px-6 py-2 text-center text-sm font-semibold text-amber-950"
    >
      <span className="mr-2" aria-hidden="true">
        ⚠
      </span>
      {PLATFORM_NAME} support session
      {impersonation.adminEmail ? ` — signed in as this business by ${impersonation.adminEmail}` : ''}
      {left ? <span className="ml-2 font-normal">({left})</span> : null}
    </div>
  )
}
