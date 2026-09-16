import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, MessageSquareText, Send } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useCreateFeedback, useEmployees, useGarage } from '../api/queries'
import { useGarageId } from '../hooks/useGarageId'
import { errorMessage, fieldErrors, isApiError } from '../lib/errors'
import type { FeedbackPriority, FeedbackType } from '../types'

const MESSAGE_MAX_LENGTH = 2000
const SUBJECT_MAX_LENGTH = 200
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: 'GENERAL', label: 'General Feedback' },
  { value: 'SUGGESTION', label: 'Suggestion / Feature Request' },
  { value: 'BUG', label: 'Bug / Technical Issue' },
  { value: 'NOT_WORKING', label: "Something Isn't Working" },
  { value: 'COMPLIMENT', label: 'Compliment' },
  { value: 'OTHER', label: 'Other' },
]

const PRIORITY_OPTIONS: { value: FeedbackPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
]

function labelForType(type: FeedbackType): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? ''
}

export function FeedbackPage() {
  const garageId = useGarageId()
  const { data: garage, isLoading: garageLoading } = useGarage()
  const { employeeId } = useAuth()
  const { data: employees } = useEmployees()
  const create = useCreateFeedback()

  const me = employees?.find((e) => e.id === employeeId)

  const [type, setType] = useState<FeedbackType>('GENERAL')
  const [subject, setSubject] = useState(labelForType('GENERAL'))
  const [subjectTouched, setSubjectTouched] = useState(false)
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<FeedbackPriority>('NORMAL')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Pre-fill from the signed-in employee's own record once it loads - never
  // overwrite it once the user has started editing it themselves.
  useEffect(() => {
    if (me?.email && !emailTouched) setEmail(me.email)
  }, [me?.email, emailTouched])

  const handleTypeChange = (value: FeedbackType) => {
    setType(value)
    if (!subjectTouched) setSubject(labelForType(value))
  }

  const messageError = message.trim().length === 0
  const emailError = !email.trim() || !EMAIL_RE.test(email.trim())
  const canSubmit = !messageError && !emailError && !create.isPending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const nextErrs: Record<string, string> = {}
    if (messageError) nextErrs.message = 'Please tell us what happened.'
    if (!email.trim()) nextErrs.email = 'An email address is required.'
    else if (emailError) nextErrs.email = 'Enter a valid email address.'
    if (Object.keys(nextErrs).length > 0) {
      setErrs(nextErrs)
      return
    }
    setErrs({})

    try {
      await create.mutateAsync({
        type,
        subject: subject.trim() || null,
        message: message.trim(),
        priority,
        email: email.trim(),
      })
      setSubmitted(true)
    } catch (err) {
      if (isApiError(err) && err.fieldErrors) {
        setErrs(fieldErrors(err))
      } else {
        setError(errorMessage(err) || "Something went wrong while sending your feedback. Please try again.")
      }
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <CircleCheck className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Thank you for your feedback!</h1>
        <p className="mt-2 text-sm text-slate-500">
          We&rsquo;ve received your feedback and appreciate you taking the time to help us improve.
        </p>
        <Link
          to={`/${garageId}/dashboard`}
          className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-6 w-6 text-slate-900" />
        <h1 className="text-2xl font-semibold text-slate-900">Send us your feedback</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Help us improve your experience. Tell us what&rsquo;s working, what isn&rsquo;t, or what
        you&rsquo;d like to see next.
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="feedback-business">
            Name of Business
          </label>
          <input
            id="feedback-business"
            type="text"
            value={garageLoading ? 'Loading…' : (garage?.name ?? '')}
            readOnly
            disabled
            className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="feedback-type">
            What can we help with?
          </label>
          <select
            id="feedback-type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as FeedbackType)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="feedback-subject">
            Subject
          </label>
          <input
            id="feedback-subject"
            type="text"
            value={subject}
            maxLength={SUBJECT_MAX_LENGTH}
            onChange={(e) => {
              setSubject(e.target.value)
              setSubjectTouched(true)
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="feedback-message">
            Tell us more
          </label>
          <textarea
            id="feedback-message"
            required
            rows={6}
            maxLength={MESSAGE_MAX_LENGTH}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setErrs((prev) => ({ ...prev, message: '' }))
            }}
            placeholder="Tell us about your experience, an issue you've encountered, or something you'd like us to improve..."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between">
            {errs.message ? (
              <p className="text-sm text-red-600">{errs.message}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-400">
              {message.length}/{MESSAGE_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="feedback-priority">
            How urgent is this?
          </label>
          <select
            id="feedback-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="feedback-email">
            Email address
          </label>
          <input
            id="feedback-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailTouched(true)
              setErrs((prev) => ({ ...prev, email: '' }))
            }}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {errs.email ? (
            <p className="mt-1 text-sm text-red-600">{errs.email}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              We&rsquo;ll use this email if we need to follow up about your feedback.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {create.isPending ? 'Sending…' : 'Send Feedback'}
        </button>
      </form>
    </div>
  )
}
