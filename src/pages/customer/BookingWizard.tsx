import { useCallback, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { WizardStepper, type WizardStep } from '../../components/customer/WizardStepper'
import { AvailabilityCalendar } from '../../components/customer/AvailabilityCalendar'
import { TimeSlotPicker } from '../../components/customer/TimeSlotPicker'
import { SelectedSlotBanner } from '../../components/customer/SelectedSlotBanner'
import { formatLongDate } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { usePublicGarage } from '../../api/queries'
import { submitBookingRequest } from '../../api/publicGarage'
import { Captcha, captchaEnabled } from '../../components/Captcha'
import { RichTextInput } from '../../components/rich/RichTextInput'
import { richFieldBoxClass, richFieldFocusClass } from '../../components/rich/richFieldStyles'

interface WizardData {
  firstName: string
  lastName: string
  email: string
  phone: string
  registration: string
  make: string
  model: string
  year: string
  mileage: string
  date: string
  time: string
  notes: string
}

const initialData: WizardData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  registration: '',
  make: '',
  model: '',
  year: '',
  mileage: '',
  date: '',
  time: '',
  notes: '',
}

type FieldErrors = Partial<Record<keyof WizardData, string>> & { form?: string }

const STEP_TIME = 1
const STEP_DETAILS = 2
const STEP_REVIEW = 3

const STEPS: WizardStep[] = [
  { id: STEP_TIME, label: 'Date & time' },
  { id: STEP_DETAILS, label: 'Vehicle & your details' },
  { id: STEP_REVIEW, label: 'Review' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateTime(d: WizardData): FieldErrors {
  const errors: FieldErrors = {}
  if (!d.date) errors.form = 'Please choose an available date.'
  else if (!d.time) errors.form = 'Please choose an available time.'
  return errors
}

function validateDetails(d: WizardData): FieldErrors {
  const errors: FieldErrors = {}
  if (!d.registration.trim()) errors.registration = 'Registration number is required.'
  if (d.year && (Number(d.year) < 1900 || Number(d.year) > new Date().getFullYear() + 1)) {
    errors.year = 'Enter a valid year.'
  }
  if (d.mileage && Number(d.mileage) < 0) errors.mileage = 'Mileage cannot be negative.'
  if (!d.firstName.trim()) errors.firstName = 'First name is required.'
  if (!d.lastName.trim()) errors.lastName = 'Last name is required.'
  if (!d.email.trim()) errors.email = 'Email is required.'
  else if (!EMAIL_RE.test(d.email)) errors.email = 'Enter a valid email address.'
  return errors
}

function validateForStep(step: number, d: WizardData): FieldErrors {
  if (step === STEP_TIME) return validateTime(d)
  if (step === STEP_DETAILS) return validateDetails(d)
  return {}
}

export function BookingWizard() {
  const { garageId: urlGarageId } = useParams<{ garageId: string }>()
  const {
    data: garage,
    isLoading: garageLoading,
  } = usePublicGarage(urlGarageId)
  const queryClient = useQueryClient()

  const garageSlug = garage?.slug ?? ''

  const [step, setStep] = useState(STEP_TIME)
  const [data, setData] = useState<WizardData>(initialData)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), [])

  const update = (field: keyof WizardData, value: string) => {
    setData((d) => ({ ...d, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const selectDate = (date: string) => {
    setData((d) => ({ ...d, date, time: '' }))
    setErrors((e) => ({ ...e, form: undefined }))
  }

  const selectSlot = (time: string) => {
    setData((d) => ({ ...d, time }))
    setErrors((e) => ({ ...e, form: undefined }))
    setStep(STEP_DETAILS)
  }

  const goNext = () => {
    const stepErrors = validateForStep(step, data)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setStep((s) => Math.min(s + 1, STEP_REVIEW))
  }

  const goBack = () => setStep((s) => Math.max(s - 1, STEP_TIME))

  const goToStep = (target: number) => {
    setErrors({})
    setStep(target)
  }

  const refreshAvailability = () => {
    queryClient.invalidateQueries({ queryKey: ['garageAvailability', garageSlug] })
    queryClient.invalidateQueries({ queryKey: ['garageDayAvailability', garageSlug] })
  }

  const handleSubmit = async () => {
    if (captchaEnabled && !captchaToken) {
      setErrors({ form: 'Please complete the verification challenge.' })
      return
    }
    setSubmitting(true)
    setErrors({})
    try {
      await submitBookingRequest(garageSlug, {
        customer_first_name: data.firstName.trim(),
        customer_last_name: data.lastName.trim(),
        customer_email: data.email.trim(),
        customer_phone: data.phone.trim() || null,
        vehicle_registration: data.registration.trim(),
        vehicle_make: data.make.trim() || null,
        vehicle_model: data.model.trim() || null,
        vehicle_year: data.year ? Number(data.year) : null,
        vehicle_mileage: data.mileage ? Number(data.mileage) : null,
        // The customer no longer picks a type or a mechanic — staff assign
        // both when they review the request. The API keeps accepting these
        // fields, so send them as null.
        appointment_type_id: null,
        preferred_date: data.date,
        preferred_time: data.time || null,
        preferred_employee_note: null,
        notes: data.notes.trim() || null,
        captcha_token: captchaToken,
      })
      setSubmitted(true)
    } catch (err) {
      // The slot was taken between loading the calendar and submitting.
      if (isApiError(err) && err.code === 409) {
        setData((d) => ({ ...d, time: '' }))
        refreshAvailability()
        setErrors({
          form: `${errorMessage(err)} We've refreshed the calendar — please pick another time.`,
        })
        setStep(STEP_TIME)
        return
      }

      const fields = fieldErrors(err)
      const mapped: FieldErrors = {}
      if (fields.customer_email) mapped.email = fields.customer_email
      if (fields.vehicle_registration) mapped.registration = fields.vehicle_registration
      const timeIssue = fields.preferred_date || fields.preferred_time
      mapped.form =
        Object.keys(mapped).length > 0 || timeIssue
          ? 'Please fix the highlighted details.'
          : errorMessage(err)
      setErrors(mapped)
      if (timeIssue) setStep(STEP_TIME)
      else if (mapped.email || mapped.registration) setStep(STEP_DETAILS)
    } finally {
      setSubmitting(false)
    }
  }

  const restart = () => {
    setData(initialData)
    setErrors({})
    setStep(STEP_TIME)
    setSubmitted(false)
    setCaptchaToken('')
  }

  if (submitted) {
    return (
      <ConfirmationScreen
        firstName={data.firstName}
        date={data.date}
        time={data.time}
        email={data.email}
        onRestart={restart}
      />
    )
  }

  if (!urlGarageId) {
    return (
      <GarageNotice
        title="Choose your garage"
        body="Open the booking link your garage gave you to get started."
      />
    )
  }
  if (garageLoading) {
    return <p className="mx-auto max-w-2xl text-sm text-slate-500">Loading…</p>
  }
  if (!garage) {
    return (
      <GarageNotice
        title="Garage not found"
        body="We couldn't find that garage — check the booking link your garage gave you."
      />
    )
  }

  const showSlotBanner = Boolean(data.date && data.time && step >= STEP_DETAILS)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">Book your vehicle in</p>
        <h1 className="text-xl font-semibold text-slate-900">{garage.name}</h1>
      </div>

      <WizardStepper steps={STEPS} currentStep={step} />

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        {showSlotBanner && (
          <SelectedSlotBanner
            date={data.date}
            time={data.time}
            onChange={() => goToStep(STEP_TIME)}
          />
        )}

        {step === STEP_TIME && (
          <DateTimeStep
            slug={garageSlug}
            date={data.date}
            time={data.time}
            onSelectDate={selectDate}
            onSelectSlot={selectSlot}
          />
        )}
        {step === STEP_DETAILS && (
          <DetailsStep data={data} errors={errors} update={update} />
        )}
        {step === STEP_REVIEW && (
          <ReviewStep
            data={data}
            garageName={garage.name}
            onEditStep={goToStep}
            onCaptchaToken={handleCaptchaToken}
          />
        )}

        {errors.form && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
          {step > STEP_TIME ? (
            <button
              type="button"
              onClick={goBack}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step === STEP_REVIEW ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Submit booking request'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={step === STEP_TIME && (!data.date || !data.time)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface StepProps {
  data: WizardData
  errors: FieldErrors
  update: (field: keyof WizardData, value: string) => void
}

function Field({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-xs font-normal text-slate-400">(optional)</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function DateTimeStep({
  slug,
  date,
  time,
  onSelectDate,
  onSelectSlot,
}: {
  slug: string
  date: string
  time: string
  onSelectDate: (date: string) => void
  onSelectSlot: (time: string) => void
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Pick a date &amp; time</h2>
      <p className="mt-1 text-sm text-slate-500">
        Green days have good availability, amber days are filling up, and red days are full.
      </p>
      <div className="mt-4">
        <AvailabilityCalendar
          slug={slug}
          selectedDate={date || null}
          onSelectDate={onSelectDate}
        />
      </div>
      {date && (
        <TimeSlotPicker
          slug={slug}
          date={date}
          selectedTime={time || null}
          onSelectSlot={onSelectSlot}
        />
      )}
    </div>
  )
}

function DetailsStep({ data, errors, update }: StepProps) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Vehicle details</h2>
        <div className="mt-4 space-y-4">
          <Field label="Registration number" required error={errors.registration}>
            <RichTextInput
              value={data.registration}
              onChange={(v) => update('registration', v.toUpperCase())}
              className="uppercase"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Make" optional error={errors.make}>
              <RichTextInput value={data.make} onChange={(v) => update('make', v)} />
            </Field>
            <Field label="Model" optional error={errors.model}>
              <RichTextInput value={data.model} onChange={(v) => update('model', v)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Year" error={errors.year}>
              <RichTextInput type="number" value={data.year} onChange={(v) => update('year', v)} />
            </Field>
            <Field label="Current mileage" optional error={errors.mileage}>
              <RichTextInput
                type="number"
                min={0}
                value={data.mileage}
                onChange={(v) => update('mileage', v)}
              />
            </Field>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Your details</h2>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required error={errors.firstName}>
              <RichTextInput value={data.firstName} onChange={(v) => update('firstName', v)} />
            </Field>
            <Field label="Last name" required error={errors.lastName}>
              <RichTextInput value={data.lastName} onChange={(v) => update('lastName', v)} />
            </Field>
          </div>
          <Field label="Email" required error={errors.email}>
            <RichTextInput type="email" value={data.email} onChange={(v) => update('email', v)} />
          </Field>
          <Field label="Phone number" error={errors.phone}>
            <RichTextInput type="tel" value={data.phone} onChange={(v) => update('phone', v)} />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Additional information</h2>
        <p className="mt-1 text-sm text-slate-500">
          Anything else you'd like the garage to know?
        </p>
        <textarea
          rows={3}
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          className={`mt-2 ${richFieldBoxClass} ${richFieldFocusClass}`}
        />
      </section>
    </div>
  )
}

function ReviewStep({
  data,
  garageName,
  onEditStep,
  onCaptchaToken,
}: {
  data: WizardData
  garageName: string
  onEditStep: (step: number) => void
  onCaptchaToken: (token: string) => void
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Review</h2>
      <p className="mt-1 text-sm text-slate-500">Please check everything below before you submit.</p>

      <div className="mt-4 space-y-4">
        <SummarySection title="Appointment" onEdit={() => onEditStep(STEP_TIME)}>
          <SummaryRow label="Garage" value={garageName} />
          <SummaryRow label="Date" value={data.date ? formatLongDate(data.date) : '—'} />
          <SummaryRow label="Time" value={data.time || '—'} />
        </SummarySection>

        <SummarySection title="Vehicle" onEdit={() => onEditStep(STEP_DETAILS)}>
          <SummaryRow label="Registration" value={data.registration} />
          <SummaryRow
            label="Make / model"
            value={[data.make, data.model].filter(Boolean).join(' ') || '—'}
          />
          <SummaryRow label="Year" value={data.year || '—'} />
          <SummaryRow label="Current mileage" value={data.mileage || '—'} />
        </SummarySection>

        <SummarySection title="Your details" onEdit={() => onEditStep(STEP_DETAILS)}>
          <SummaryRow label="Name" value={`${data.firstName} ${data.lastName}`.trim()} />
          <SummaryRow label="Email" value={data.email} />
          <SummaryRow label="Phone" value={data.phone || '—'} />
        </SummarySection>

        <SummarySection title="Additional information" onEdit={() => onEditStep(STEP_DETAILS)}>
          <SummaryRow label="Customer notes" value={data.notes.trim() || 'None provided'} />
        </SummarySection>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        Submitting sends a request to {garageName}. They'll review it and be in touch at{' '}
        {data.email || 'the email you gave'} to confirm.
      </p>

      {captchaEnabled && (
        <div className="mt-4">
          <Field label="Verification" required>
            <Captcha onToken={onCaptchaToken} />
          </Field>
        </div>
      )}
    </div>
  )
}

function SummarySection({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Edit
        </button>
      </div>
      <dl className="mt-2 space-y-1">{children}</dl>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  )
}

function GarageNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">{body}</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Back to home
      </Link>
    </div>
  )
}

function ConfirmationScreen({
  firstName,
  date,
  time,
  email,
  onRestart,
}: {
  firstName: string
  date: string
  time: string
  email: string
  onRestart: () => void
}) {
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Request received</h1>
      <p className="mt-2 text-slate-600">
        Thanks, {firstName}. We've sent your request for {date ? formatLongDate(date) : ''} at {time}.
        The garage will review it and be in touch at {email} to confirm.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Book another
        </button>
        <Link
          to="/"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
