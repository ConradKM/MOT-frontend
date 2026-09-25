import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useJoinQueue, usePublicGarage, usePublicQueue } from '../../api/queries'
import { BusinessBrandMark } from '../../components/BusinessBrandMark'
import { Captcha, captchaEnabled } from '../../components/Captcha'
import { queueStatusPath } from '../../lib/bookingUrl'
import { formatTime } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { isPlausibleUkMobile } from '../../lib/phone'
import { formatWait, readStoredQueueToken, storeQueueToken } from '../../lib/queue'

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'

interface Form {
  firstName: string
  lastName: string
  phone: string
  registration: string
  serviceId: string
  smsOptIn: boolean
}

type Errors = Partial<Record<keyof Form | 'form', string>>

// Backend field name -> this form's field, for 422s.
const SERVER_FIELDS: Record<string, keyof Form> = {
  customer_first_name: 'firstName',
  customer_last_name: 'lastName',
  customer_phone: 'phone',
  vehicle_registration: 'registration',
  appointment_type_id: 'serviceId',
}

function validate(form: Form): Errors {
  const errors: Errors = {}
  if (!form.firstName.trim()) errors.firstName = 'First name is required.'
  if (!form.phone.trim()) errors.phone = 'Mobile number is required.'
  else if (!isPlausibleUkMobile(form.phone)) {
    errors.phone = 'Enter a valid UK mobile number, e.g. 07123 456789.'
  }
  return errors
}

export function QueueNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  )
}

/**
 * Public walk-in queue page - what a business's queue QR code opens
 * (`/queue/<garage id>`). No account: name + mobile, and you're in line.
 */
export function QueueJoin() {
  const { garageId } = useParams<{ garageId: string }>()
  const navigate = useNavigate()
  const { data: garage, isLoading: garageLoading } = usePublicGarage(garageId)
  const { data: queue } = usePublicQueue(garage?.slug)
  const join = useJoinQueue(garage?.slug)

  const [form, setForm] = useState<Form>({
    firstName: '',
    lastName: '',
    phone: '',
    registration: '',
    serviceId: '',
    smsOptIn: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [captchaToken, setCaptchaToken] = useState('')
  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), [])
  const existingToken = garageId ? readStoredQueueToken(garageId) : null

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  if (garageLoading) return <p className="text-sm text-slate-500">Loading…</p>
  if (!garage || !garageId) {
    return (
      <QueueNotice
        title="Business not found"
        body="We couldn't find that business — check the link or QR code you used."
      />
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(form)
    if (captchaEnabled && !captchaToken) found.form = 'Please complete the verification.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      const joined = await join.mutateAsync({
        customer_first_name: form.firstName.trim(),
        customer_last_name: form.lastName.trim() || null,
        customer_phone: form.phone,
        sms_opt_in: form.smsOptIn,
        vehicle_registration: form.registration.trim() || null,
        appointment_type_id: form.serviceId || null,
        captcha_token: captchaToken || undefined,
      })
      storeQueueToken(garageId, joined.token)
      navigate(queueStatusPath(garageId, joined.token))
    } catch (err) {
      const mapped: Errors = {}
      for (const [field, message] of Object.entries(fieldErrors(err))) {
        const key = SERVER_FIELDS[field]
        if (key) mapped[key] = message
      }
      if (Object.keys(mapped).length === 0 || (isApiError(err) && err.code !== 422)) {
        mapped.form = errorMessage(err)
      }
      setErrors(mapped)
      setCaptchaToken('')
    }
  }

  const accepting = queue?.accepting_joins ?? false

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-center gap-3">
        <BusinessBrandMark name={garage.name} logoUrl={garage.logo_url} />
        <div>
          <p className="text-sm font-medium text-slate-500">Walk-in queue</p>
          <h1 className="text-xl font-semibold text-slate-900">{garage.name}</h1>
        </div>
      </div>

      {existingToken && (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Already in the queue?{' '}
          <Link to={queueStatusPath(garageId, existingToken)} className="font-medium underline">
            See your place
          </Link>
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {!queue ? (
          <p className="text-sm text-slate-500">Checking the queue…</p>
        ) : !accepting ? (
          <div role="status">
            <p className="text-sm font-semibold text-slate-900">Not taking walk-ins right now</p>
            <p className="mt-1 text-sm text-slate-500">
              {queue.refusal_message ?? 'The walk-in queue is closed.'}
            </p>
            <Link
              to={`/book/${garageId}`}
              className="mt-4 inline-block text-sm font-medium text-slate-900 underline"
            >
              Book an appointment instead
            </Link>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4" aria-label="Current queue">
              <div>
                <dt className="text-xs text-slate-500">People waiting</dt>
                <dd className="text-2xl font-semibold text-slate-900">{queue.waiting_count}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Estimated wait</dt>
                <dd className="text-2xl font-semibold text-slate-900">
                  {formatWait(queue.estimated_wait_minutes)}
                </dd>
                {queue.estimated_start_at && (queue.estimated_wait_minutes ?? 0) > 0 && (
                  <dd className="text-xs text-slate-500">
                    around {formatTime(queue.estimated_start_at)}
                  </dd>
                )}
              </div>
            </dl>

            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  First name
                  <input
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    autoComplete="given-name"
                    className={inputClass}
                    aria-invalid={!!errors.firstName}
                  />
                  {errors.firstName && (
                    <span className="mt-1 block text-xs text-red-600">{errors.firstName}</span>
                  )}
                </label>
                <label className="block text-sm text-slate-700">
                  Last name (optional)
                  <input
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    autoComplete="family-name"
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="block text-sm text-slate-700">
                Mobile number
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  autoComplete="tel"
                  placeholder="07123 456789"
                  className={inputClass}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && (
                  <span className="mt-1 block text-xs text-red-600">{errors.phone}</span>
                )}
              </label>
              <label className="block text-sm text-slate-700">
                Vehicle registration (optional)
                <input
                  value={form.registration}
                  onChange={(e) => set('registration', e.target.value.toUpperCase())}
                  className={inputClass}
                />
              </label>
              {garage.appointment_types.length > 0 && (
                <label className="block text-sm text-slate-700">
                  What do you need? (optional)
                  <select
                    value={form.serviceId}
                    onChange={(e) => set('serviceId', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not sure yet</option>
                    {garage.appointment_types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.smsOptIn}
                  onChange={(e) => set('smsOptIn', e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Text me when it's my turn
                  <span className="block text-xs text-slate-500">
                    You can always check your place on the next page, text or no text.
                  </span>
                </span>
              </label>

              <Captcha onToken={handleCaptchaToken} />

              {errors.form && (
                <p className="text-sm text-red-600" role="alert">
                  {errors.form}
                </p>
              )}
              <button
                type="submit"
                disabled={join.isPending}
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {join.isPending ? 'Joining…' : 'Join the queue'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
