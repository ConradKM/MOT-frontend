import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { checkResetToken, resetPassword } from '../api/auth'
import { errorMessage } from '../lib/errors'

const PASSWORD_MIN = 8
const INVALID_MSG =
  'This password reset link is invalid or has expired. Please request a new one.'

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()

  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setStatus('invalid')
      return
    }
    checkResetToken(token).then((ok) => {
      if (!cancelled) setStatus(ok ? 'valid' : 'invalid')
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < PASSWORD_MIN) {
      setError(`Password must be at least ${PASSWORD_MIN} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      navigate('/login?reset=1', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setStatus('invalid') // most likely the token expired mid-flow
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Reset password</h1>

        {status === 'checking' && (
          <p className="mt-3 text-sm text-slate-500">Checking your link…</p>
        )}

        {status === 'invalid' && (
          <>
            <p className="mt-3 text-sm text-red-700">{error ?? INVALID_MSG}</p>
            <p className="mt-6 text-center text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-slate-900 hover:underline"
              >
                Request a new link
              </Link>
            </p>
          </>
        )}

        {status === 'valid' && (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={PASSWORD_MIN}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">At least {PASSWORD_MIN} characters.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="confirm">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
