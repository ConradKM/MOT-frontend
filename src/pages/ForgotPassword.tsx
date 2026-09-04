import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'

const GENERIC =
  'If an account exists for this email address, a password reset link has been sent.'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await forgotPassword(email)
    } catch {
      // Deliberately swallow — the response must not reveal anything.
    } finally {
      setSubmitting(false)
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Forgot password</h1>

        {sent ? (
          <>
            <p className="mt-3 text-sm text-slate-600">{GENERIC}</p>
            <p className="mt-6 text-center text-sm">
              <Link to="/login" className="font-medium text-slate-900 hover:underline">
                Back to login
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              Enter your garage-login email and we'll send you a reset link.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
              <p className="text-center text-sm">
                <Link to="/login" className="font-medium text-slate-600 hover:underline">
                  Back to login
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
