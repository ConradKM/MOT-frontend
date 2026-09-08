import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthCard } from '../components/AuthCard'
import { useAuth } from '../auth/AuthContext'
import { useCustomerAuth } from '../auth/CustomerAuthContext'
import { errorMessage, fieldErrors } from '../lib/errors'

type Account = 'customer' | 'business'
type CustomerMethod = 'reference' | 'password'

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? 'rounded bg-white py-1.5 text-slate-900 shadow-sm'
          : 'rounded py-1.5 text-slate-500 hover:text-slate-700'
      }
    >
      {children}
    </button>
  )
}

/** One sign-in page for both audiences: a customer (booking reference, or a
 * password once they've set one) and business staff (email + password).
 * Reachable at /login (defaults to Business) and /customer/login (defaults
 * to Customer) - existing links/redirects into either URL still land on the
 * right tab; switching tabs here doesn't change the URL. */
export function SignIn() {
  const location = useLocation()
  const [account, setAccount] = useState<Account>(
    location.pathname === '/customer/login' ? 'customer' : 'business',
  )

  return (
    <AuthCard>
      <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>

      <div
        role="tablist"
        aria-label="Account type"
        className="mt-6 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1 text-sm font-medium"
      >
        <Tab active={account === 'customer'} onClick={() => setAccount('customer')}>
          Customer
        </Tab>
        <Tab active={account === 'business'} onClick={() => setAccount('business')}>
          Business
        </Tab>
      </div>

      {account === 'customer' ? <CustomerSignIn /> : <BusinessSignIn />}

      <p className="mt-6 text-center text-sm text-slate-500">
        Looking to book an appointment?{' '}
        <Link to="/book" className="font-medium text-slate-900 hover:underline">
          Start a booking
        </Link>
      </p>
    </AuthCard>
  )
}

function CustomerSignIn() {
  const { loginWithReference, loginWithPassword } = useCustomerAuth()
  const navigate = useNavigate()
  const [method, setMethod] = useState<CustomerMethod>('reference')
  const [email, setEmail] = useState('')
  const [bookingReference, setBookingReference] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const switchMethod = (next: CustomerMethod) => {
    setMethod(next)
    setErrors({})
    setFormError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})
    setFormError(null)
    try {
      if (method === 'reference') {
        await loginWithReference(email, bookingReference)
      } else {
        await loginWithPassword(email, password)
      }
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
    <div className="mt-6">
      <p className="text-sm text-slate-500">
        Sign in with your booking reference, or your password if you've set one.
      </p>

      <div
        role="tablist"
        aria-label="Sign-in method"
        className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1 text-sm font-medium"
      >
        <Tab active={method === 'reference'} onClick={() => switchMethod('reference')}>
          Booking reference
        </Tab>
        <Tab active={method === 'password'} onClick={() => switchMethod('password')}>
          Password
        </Tab>
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="customer-email">
            Email
          </label>
          <input
            id="customer-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        {method === 'reference' ? (
          <div>
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="booking-reference"
            >
              Booking reference
            </label>
            <input
              id="booking-reference"
              type="text"
              required
              value={bookingReference}
              onChange={(e) => setBookingReference(e.target.value.toUpperCase())}
              placeholder="e.g. BK7F3K9Q2"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-slate-500 focus:outline-none"
            />
            {errors.booking_reference && (
              <p className="mt-1 text-sm text-red-600">{errors.booking_reference}</p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Found on your booking confirmation screen or email.
            </p>
          </div>
        ) : (
          <div>
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="customer-password"
            >
              Password
            </label>
            <input
              id="customer-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function BusinessSignIn() {
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
    <div className="mt-6">
      <p className="text-sm text-slate-500">Access your business dashboard.</p>

      {justReset && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Your password has been reset successfully. You can now log in.
        </p>
      )}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="business-email">
            Email
          </label>
          <input
            id="business-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="business-password">
            Password
          </label>
          <input
            id="business-password"
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
    </div>
  )
}
