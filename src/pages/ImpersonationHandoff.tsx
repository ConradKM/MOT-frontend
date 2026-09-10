import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthCard } from '../components/AuthCard'
import { useAuth } from '../auth/AuthContext'
import { exchangeImpersonationCode } from '../api/auth'
import { errorMessage } from '../lib/errors'
import { PLATFORM_NAME } from '../lib/branding'

/**
 * Landing point for a {PLATFORM_NAME} Platform Admin support impersonation.
 *
 * The admin console sends the operator here as `/impersonate#code=...`. The
 * code arrives in the URL *fragment* on purpose: a fragment is never sent to a
 * server, so the value doesn't reach this app's static host or its logs. It is
 * also single-use and valid for about a minute — this page immediately
 * exchanges it for the real (short-lived) token and strips it from the address
 * bar, so a copied URL or a back-button press leaves nothing usable behind.
 */
export function ImpersonationHandoff() {
  const navigate = useNavigate()
  const { startImpersonation } = useAuth()
  const [error, setError] = useState<string | null>(null)
  // React 18+ StrictMode double-invokes effects in development; the code is
  // single-use, so a second exchange would fail and show a spurious error.
  const exchanged = useRef(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    const code = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('code')

    // Strip the code from the address bar before anything else, so it can't be
    // copied out of the URL or restored by navigating back to this entry.
    window.history.replaceState(null, '', window.location.pathname)

    if (!code) {
      setError('This support link is missing its code. Start the session again from Platform Admin.')
      return
    }

    exchangeImpersonationCode(code)
      .then((grant) => {
        startImpersonation(grant.access_token)
        navigate(`/${grant.garage.id}/dashboard`, { replace: true })
      })
      .catch((err) => setError(errorMessage(err)))
    // Runs exactly once, guarded by `exchanged` — re-running would burn a
    // second code that doesn't exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <AuthCard>
        <h1 className="text-xl font-semibold text-slate-900">Support session unavailable</h1>
        <p className="mt-3 text-sm text-slate-600">{error}</p>
        <p className="mt-4 text-sm text-slate-500">
          Support links are single-use and expire within about a minute. Ask {PLATFORM_NAME}{' '}
          Platform Admin to start a new one.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold text-slate-900">Starting support session</h1>
      <p className="mt-3 text-sm text-slate-600">Opening this business&rsquo;s account&hellip;</p>
    </AuthCard>
  )
}
