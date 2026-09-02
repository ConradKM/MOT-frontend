import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
import { errorMessage, fieldErrors } from '../../lib/errors'

export function CustomerLogin() {
  const { login } = useCustomerAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [registration, setRegistration] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})
    setFormError(null)
    try {
      await login(email, registration)
      navigate('/customer/account', { replace: true })
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with your email and one of your vehicle registrations.
        </p>

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
            <label className="block text-sm font-medium text-slate-700" htmlFor="registration">
              Vehicle registration
            </label>
            <input
              id="registration"
              type="text"
              required
              value={registration}
              onChange={(e) => setRegistration(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-slate-500 focus:outline-none"
            />
            {errors.registration_number && (
              <p className="mt-1 text-sm text-red-600">{errors.registration_number}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Need to book instead?{' '}
          <Link to="/book" className="font-medium text-slate-900 hover:underline">
            Start a booking
          </Link>
        </p>
      </div>
    </div>
  )
}
