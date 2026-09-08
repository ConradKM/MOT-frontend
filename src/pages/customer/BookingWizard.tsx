import { useCallback, useId, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { WizardStepper, type WizardStep } from '../../components/customer/WizardStepper'
import { AvailabilityCalendar } from '../../components/customer/AvailabilityCalendar'
import { TimeSlotPicker } from '../../components/customer/TimeSlotPicker'
import { SelectedSlotBanner } from '../../components/customer/SelectedSlotBanner'
import { formatLongDate } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { usePublicGarage } from '../../api/queries'
import { submitBookingRequest, type PublicAppointmentType } from '../../api/publicGarage'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
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
  appointmentTypeId: string
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
  appointmentTypeId: '',
  time: '',
  notes: '',
}

/** "09:00" + 90 -> "10:30" - the expected finish time shown on review. */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = Math.floor((total % (24 * 60)) / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
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

// A light client-side sanity check only - the server (app/phone.py) does the
// real, authoritative parsing/normalisation to E.164. This just gives fast
// feedback without making the customer type "+44" themselves: 07…, +447…
// and 00447… are all accepted, spaces/dashes/brackets are ignored.
const UK_MOBILE_RE = /^(?:\+44|0044|0)7\d{9}$/

function isPlausibleUkMobile(value: string): boolean {
  return UK_MOBILE_RE.test(value.replace(/[\s\-()]/g, ''))
}

function validateTime(d: WizardData, requiresType: boolean): FieldErrors {
  const errors: FieldErrors = {}
  if (!d.date) errors.form = 'Please choose an available date.'
  else if (requiresType && !d.appointmentTypeId) {
    errors.form = 'Please choose what you would like to book.'
  } else if (!d.time) errors.form = 'Please choose an available time.'
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
  if (!d.phone.trim()) errors.phone = 'Mobile number is required.'
  else if (!isPlausibleUkMobile(d.phone)) {
    errors.phone = 'Enter a valid UK mobile number, e.g. 07123 456789.'
  }
  return errors
}

function validateForStep(step: number, d: WizardData, requiresType: boolean): FieldErrors {
  if (step === STEP_TIME) return validateTime(d, requiresType)
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
  const { loginWithReference } = useCustomerAuth()

  const garageSlug = garage?.slug ?? ''

  const [step, setStep] = useState(STEP_TIME)
  const [data, setData] = useState<WizardData>(initialData)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingReference, setBookingReference] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')

  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), [])

  const update = (field: keyof WizardData, value: string) => {
    setData((d) => ({ ...d, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const selectDate = (date: string) => {
    // The chosen service persists across a date change (still driving
    // duration once a new time is picked) - only the stale time resets.
    setData((d) => ({ ...d, date, time: '' }))
    setErrors((e) => ({ ...e, form: undefined }))
  }

  const selectType = (appointmentTypeId: string) => {
    // Duration just changed, so any previously-picked time may no longer be
    // valid (item 13) - clear it and let the customer re-pick.
    setData((d) => ({ ...d, appointmentTypeId, time: '' }))
    setErrors((e) => ({ ...e, form: undefined }))
  }

  const selectSlot = (time: string) => {
    setData((d) => ({ ...d, time }))
    setErrors((e) => ({ ...e, form: undefined }))
    setStep(STEP_DETAILS)
  }

  const requiresType = (garage?.appointment_types.length ?? 0) > 0

  const goNext = () => {
    const stepErrors = validateForStep(step, data, requiresType)
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
      setErrors({ form: 'Please confirm that you are not a robot.' })
      return
    }
    setSubmitting(true)
    setErrors({})
    try {
      const email = data.email.trim()
      const result = await submitBookingRequest(garageSlug, {
        customer_first_name: data.firstName.trim(),
        customer_last_name: data.lastName.trim(),
        customer_email: email,
        // Required (validated above) - the server normalises it to E.164.
        customer_phone: data.phone.trim(),
        vehicle_registration: data.registration.trim(),
        vehicle_make: data.make.trim() || null,
        vehicle_model: data.model.trim() || null,
        vehicle_year: data.year ? Number(data.year) : null,
        vehicle_mileage: data.mileage ? Number(data.mileage) : null,
        // The customer's chosen service - its duration is what determined
        // which times were even offered (item 2/12). Null only for a garage
        // with no appointment types configured; staff assign a mechanic
        // either way when they review the request.
        appointment_type_id: data.appointmentTypeId || null,
        preferred_date: data.date,
        preferred_time: data.time || null,
        preferred_employee_note: null,
        notes: data.notes.trim() || null,
        captcha_token: captchaToken,
      })
      setBookingReference(result.booking_reference)
      // The account (Customer + Vehicle) already exists at this point (see
      // app/public_booking/routes.py), so sign the customer straight in with
      // the reference just issued - "View my account" then works immediately
      // without asking them to log in again. Best-effort: if it fails for any
      // reason, the confirmation screen still shows the reference to log in
      // with by hand.
      if (result.booking_reference) {
        void loginWithReference(email, result.booking_reference).catch(() => {})
      }
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

      // CAPTCHA rejected / expired server-side (the only 400 this endpoint
      // returns). Void the stale token and let the customer verify again -
      // their date/time and form details are untouched.
      if (isApiError(err) && err.code === 400) {
        setCaptchaToken('')
        setErrors({
          form: 'Verification failed or expired. Please confirm that you are not a robot and try again.',
        })
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
    setBookingReference(null)
    setCaptchaToken('')
  }

  if (submitted) {
    return (
      <ConfirmationScreen
        firstName={data.firstName}
        date={data.date}
        time={data.time}
        email={data.email}
        bookingReference={bookingReference}
        onRestart={restart}
      />
    )
  }

  if (!urlGarageId) {
    return (
      <GarageNotice
        title="Booking link needed"
        body="Please use your business's booking link to start a booking."
      />
    )
  }
  if (garageLoading) {
    return <p className="mx-auto max-w-2xl text-sm text-slate-500">Loading…</p>
  }
  if (!garage) {
    return (
      <GarageNotice
        title="Business not found"
        body="We couldn't find that business — check the booking link the business gave you."
      />
    )
  }

  const showSlotBanner = Boolean(data.date && data.time && step >= STEP_DETAILS)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">Book an appointment</p>
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
            appointmentTypes={garage.appointment_types}
            appointmentTypeId={data.appointmentTypeId}
            time={data.time}
            onSelectDate={selectDate}
            onSelectType={selectType}
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
            appointmentType={garage.appointment_types.find((t) => t.id === data.appointmentTypeId)}
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

/** Props a Field hands its control so the label, the control and any
 * validation message are programmatically associated - without them a screen
 * reader announces an unnamed "edit text" for every field on this form. */
interface FieldControlProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': boolean | undefined
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
  children: (control: FieldControlProps) => ReactNode
}) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-xs font-normal text-slate-400">(optional)</span>}
      </label>
      <div className="mt-1">
        {children({
          id,
          'aria-describedby': error ? errorId : undefined,
          'aria-invalid': error ? true : undefined,
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

function DateTimeStep({
  slug,
  date,
  appointmentTypes,
  appointmentTypeId,
  time,
  onSelectDate,
  onSelectType,
  onSelectSlot,
}: {
  slug: string
  date: string
  appointmentTypes: PublicAppointmentType[]
  appointmentTypeId: string
  time: string
  onSelectDate: (date: string) => void
  onSelectType: (id: string) => void
  onSelectSlot: (time: string) => void
}) {
  const hasTypes = appointmentTypes.length > 0
  const readyForTimes = !hasTypes || !!appointmentTypeId

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
      {date && hasTypes && (
        <AppointmentTypeStep
          appointmentTypes={appointmentTypes}
          selectedId={appointmentTypeId}
          onSelect={onSelectType}
        />
      )}
      {date && readyForTimes && (
        <TimeSlotPicker
          slug={slug}
          date={date}
          appointmentTypeId={appointmentTypeId || undefined}
          selectedTime={time || null}
          onSelectSlot={onSelectSlot}
        />
      )}
    </div>
  )
}

function AppointmentTypeStep({
  appointmentTypes,
  selectedId,
  onSelect,
}: {
  appointmentTypes: PublicAppointmentType[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const selected = appointmentTypes.find((t) => t.id === selectedId)

  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900">What would you like to book?</h3>
      <ul className="mt-3 space-y-2">
        {appointmentTypes.map((type) => {
          const isSelected = type.id === selectedId
          return (
            <li key={type.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(type.id)}
                className={[
                  'w-full rounded-md border px-3 py-2 text-left transition',
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 hover:border-slate-500',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{type.name}</span>
                  <span className={`text-sm ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                    {[
                      type.base_price != null ? `£${type.base_price}` : null,
                      type.default_duration_minutes != null
                        ? `${type.default_duration_minutes} min`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                {type.description && (
                  <p
                    className={`mt-0.5 text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}
                  >
                    {type.description}
                  </p>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {selected && selected.included_items.length > 0 && (
        <details className="mt-3 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">What's included</summary>
          <ul className="mt-2 space-y-1 pl-1">
            {selected.included_items.map((item, i) => (
              <li key={i}>
                <span aria-hidden="true">✓</span> {item.label}
                {item.description && (
                  <span className="text-slate-400"> — {item.description}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
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
            {(control) => (
              <RichTextInput
                {...control}
                value={data.registration}
                onChange={(v) => update('registration', v.toUpperCase())}
                className="uppercase"
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Make" optional error={errors.make}>
              {(control) => (
                <RichTextInput {...control} value={data.make} onChange={(v) => update('make', v)} />
              )}
            </Field>
            <Field label="Model" optional error={errors.model}>
              {(control) => (
                <RichTextInput {...control} value={data.model} onChange={(v) => update('model', v)} />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Year" optional error={errors.year}>
              {(control) => (
                <RichTextInput
                  {...control}
                  type="number"
                  value={data.year}
                  onChange={(v) => update('year', v)}
                />
              )}
            </Field>
            <Field label="Current mileage" optional error={errors.mileage}>
              {(control) => (
                <RichTextInput
                  {...control}
                  type="number"
                  min={0}
                  value={data.mileage}
                  onChange={(v) => update('mileage', v)}
                />
              )}
            </Field>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Your details</h2>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name" required error={errors.firstName}>
              {(control) => (
                <RichTextInput
                  {...control}
                  value={data.firstName}
                  onChange={(v) => update('firstName', v)}
                />
              )}
            </Field>
            <Field label="Last name" required error={errors.lastName}>
              {(control) => (
                <RichTextInput
                  {...control}
                  value={data.lastName}
                  onChange={(v) => update('lastName', v)}
                />
              )}
            </Field>
          </div>
          <Field label="Email" required error={errors.email}>
            {(control) => (
              <RichTextInput
                {...control}
                type="email"
                value={data.email}
                onChange={(v) => update('email', v)}
              />
            )}
          </Field>
          <Field label="Mobile number" required error={errors.phone}>
            {(control) => (
              <RichTextInput
                {...control}
                type="tel"
                value={data.phone}
                onChange={(v) => update('phone', v)}
                placeholder="07123 456789"
              />
            )}
          </Field>
          <p className="-mt-2 text-xs text-slate-400">
            We'll text you about this booking - no need to add +44, just enter it as you normally
            would.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Additional information</h2>
        <p className="mt-1 text-sm text-slate-500">
          Anything else you'd like the garage to know?
        </p>
        <label className="sr-only" htmlFor="booking-notes">
          Additional information
        </label>
        <textarea
          id="booking-notes"
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
  appointmentType,
  onEditStep,
  onCaptchaToken,
}: {
  data: WizardData
  garageName: string
  appointmentType: PublicAppointmentType | undefined
  onEditStep: (step: number) => void
  onCaptchaToken: (token: string) => void
}) {
  const finishTime =
    data.time && appointmentType?.default_duration_minutes != null
      ? addMinutesToTime(data.time, appointmentType.default_duration_minutes)
      : null

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Review</h2>
      <p className="mt-1 text-sm text-slate-500">Please check everything below before you submit.</p>

      <div className="mt-4 space-y-4">
        <SummarySection title="Appointment" onEdit={() => onEditStep(STEP_TIME)}>
          <SummaryRow label="Business" value={garageName} />
          {appointmentType && <SummaryRow label="Service" value={appointmentType.name} />}
          {appointmentType?.base_price != null && (
            <SummaryRow label="Price" value={`£${appointmentType.base_price}`} />
          )}
          <SummaryRow label="Date" value={data.date ? formatLongDate(data.date) : '—'} />
          <SummaryRow
            label="Time"
            value={data.time ? (finishTime ? `${data.time}–${finishTime}` : data.time) : '—'}
          />
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
          <SummaryRow label="Mobile number" value={data.phone || '—'} />
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
            {() => <Captcha onToken={onCaptchaToken} />}
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
    </div>
  )
}

function ConfirmationScreen({
  firstName,
  date,
  time,
  email,
  bookingReference,
  onRestart,
}: {
  firstName: string
  date: string
  time: string
  email: string
  bookingReference: string | null
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
        The business will review it and be in touch at {email} to confirm.
      </p>

      {bookingReference && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Booking reference
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">
            {bookingReference}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Keep this to sign in and check your booking later.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Book another appointment
        </button>
        <Link
          to="/customer/account"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          View my account
        </Link>
      </div>
    </div>
  )
}
