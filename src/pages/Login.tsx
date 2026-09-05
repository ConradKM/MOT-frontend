import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthCard } from '../components/AuthCard'
import { useAuth } from '../auth/AuthContext'
import { errorMessage, fieldErrors } from '../lib/errors'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const justReset = params.get('reset') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})
    setFormError(null)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Access your garage's dashboard.</p>

      {justReset && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Your password has been reset successfully. You can now log in.
        </p>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

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
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Login'}
        </button>

        <p className="text-center text-sm">
          <Link
            to="/forgot-password"
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Looking to book an MOT or service?{' '}
        <Link to="/" className="font-medium text-slate-900 hover:underline">
          Book here
        </Link>
      </p>
    </AuthCard>
  )
}
