import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { WizardStepper, type WizardStep } from '../../components/customer/WizardStepper'
import { AvailabilityCalendar } from '../../components/customer/AvailabilityCalendar'
import { TimeSlotPicker } from '../../components/customer/TimeSlotPicker'
import { SelectedSlotBanner } from '../../components/customer/SelectedSlotBanner'
import { IncludedItems, ServicePicker } from '../../components/customer/ServicePicker'
import {
  BookingSection,
  initialAnswers,
  toAnswerInput,
  validateAnswers,
  type AnswerMap,
  type AnswerState,
} from '../../components/customer/BookingFieldInput'
import { formatLongDate } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useBookingFlow, usePublicGarage } from '../../api/queries'
import {
  submitBookingRequest,
  type BookingFlowSection,
  type PublicAppointmentType,
} from '../../api/publicGarage'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
import { Captcha, captchaEnabled } from '../../components/Captcha'
import { RichTextInput } from '../../components/rich/RichTextInput'

/** What the platform itself needs, and the only thing a business cannot
 * configure away: without these there is no account to attach the booking to,
 * nowhere to send the confirmation, and no reference to look it up with.
 * Everything else the customer is asked comes from the business's own
 * workflow (see useBookingFlow). */
interface WizardData {
  firstName: string
  lastName: string
  email: string
  phone: string
  date: string
  appointmentTypeId: string
  time: string
}

const initialData: WizardData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  date: '',
  appointmentTypeId: '',
  time: '',
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

// Service first: choosing a date before knowing what is being booked is
// backwards for the customer, and wrong for the calendar - day availability
// depends on how long the chosen service takes.
const STEP_SERVICE = 1
const STEP_TIME = 2
const STEP_DETAILS = 3
const STEP_REVIEW = 4

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A light client-side sanity check only - the server (app/phone.py) does the
// real, authoritative parsing/normalisation to E.164. This just gives fast
// feedback without making the customer type "+44" themselves: 07…, +447…
// and 00447… are all accepted, spaces/dashes/brackets are ignored.
const UK_MOBILE_RE = /^(?:\+44|0044|0)7\d{9}$/

function isPlausibleUkMobile(value: string): boolean {
  return UK_MOBILE_RE.test(value.replace(/[\s\-()]/g, ''))
}

function validateYourDetails(d: WizardData): FieldErrors {
  const errors: FieldErrors = {}
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

export function BookingWizard() {
  const { garageId: urlGarageId } = useParams<{ garageId: string }>()
  const [searchParams] = useSearchParams()
  const { data: garage, isLoading: garageLoading } = usePublicGarage(urlGarageId)
  const queryClient = useQueryClient()
  const { loginWithReference } = useCustomerAuth()

  const garageSlug = garage?.slug ?? ''

  const [step, setStep] = useState(STEP_SERVICE)
  const [data, setData] = useState<WizardData>(initialData)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingReference, setBookingReference] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const [deepLinkApplied, setDeepLinkApplied] = useState(false)

  const services = useMemo(() => garage?.appointment_types ?? [], [garage])
  const hasServices = services.length > 0

  const { data: flow } = useBookingFlow(garageSlug, data.appointmentTypeId || undefined)
  const sections: BookingFlowSection[] = useMemo(() => flow?.sections ?? [], [flow])

  // Seed an entry per configured field whenever the workflow changes - which
  // it does when the chosen service has its own override.
  useEffect(() => {
    setAnswers((current) => {
      const seeded = initialAnswers(sections)
      // Keep anything already typed for a field that survived the change, so
      // going back to swap service doesn't silently wipe the form.
      for (const [id, answer] of Object.entries(current)) {
        if (id in seeded) seeded[id] = answer
      }
      return seeded
    })
  }, [sections])

  /**
   * Deep link: /book/<id>?service=<id> or ?group=<id>.
   *
   * A business can put a button on its own site that drops the customer
   * straight onto the date step for one service. Applied once, before first
   * paint of the service step, so the stepper and the calendar start in the
   * right place rather than visibly jumping.
   */
  useEffect(() => {
    if (deepLinkApplied || !hasServices) return

    const serviceParam = searchParams.get('service')
    const groupParam = searchParams.get('group')

    const target = serviceParam
      ? services.find((s) => s.id === serviceParam)
      : // A group link narrows to that group; it only auto-selects when the
        // group holds exactly one service, since otherwise the customer still
        // has a real choice to make.
        groupParam
        ? singleServiceIn(services, groupParam)
        : undefined

    if (target) {
      setData((d) => ({ ...d, appointmentTypeId: target.id }))
      setStep(STEP_TIME)
    }
    setDeepLinkApplied(true)
  }, [deepLinkApplied, hasServices, searchParams, services])

  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), [])

  const update = (field: keyof WizardData, value: string) => {
    setData((d) => ({ ...d, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const updateAnswer = (fieldId: string, next: AnswerState) => {
    setAnswers((a) => ({ ...a, [fieldId]: next }))
    setAnswerErrors((e) => (e[fieldId] ? { ...e, [fieldId]: '' } : e))
  }

  const selectService = (appointmentTypeId: string) => {
    // Duration drives which days and times are even offered, so a service
    // change invalidates any date/time already picked.
    setData((d) => ({ ...d, appointmentTypeId, date: '', time: '' }))
    setErrors({})
    setStep(STEP_TIME)
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

  const steps: WizardStep[] = useMemo(() => {
    const all: WizardStep[] = [
      { id: STEP_SERVICE, label: 'Service' },
      { id: STEP_TIME, label: 'Date & time' },
      { id: STEP_DETAILS, label: 'Your details' },
      { id: STEP_REVIEW, label: 'Review' },
    ]
    // A business with nothing configured to book has no choice to present -
    // showing an empty first step would be a dead end.
    return hasServices ? all : all.filter((s) => s.id !== STEP_SERVICE)
  }, [hasServices])

  // Same reason: skip straight past the service step when there is nothing
  // to choose between.
  useEffect(() => {
    if (!garageLoading && garage && !hasServices && step === STEP_SERVICE) {
      setStep(STEP_TIME)
    }
  }, [garage, garageLoading, hasServices, step])

  const goNext = () => {
    if (step === STEP_TIME) {
      if (!data.date) return setErrors({ form: 'Please choose an available date.' })
      if (!data.time) return setErrors({ form: 'Please choose an available time.' })
    }
    if (step === STEP_DETAILS) {
      const detailErrors = validateYourDetails(data)
      const configuredErrors = validateAnswers(sections, answers)
      if (Object.keys(detailErrors).length > 0 || Object.keys(configuredErrors).length > 0) {
        setErrors({
          ...detailErrors,
          form: 'Please fix the highlighted details.',
        })
        setAnswerErrors(configuredErrors)
        return
      }
    }
    setErrors({})
    setAnswerErrors({})
    setStep((s) => Math.min(s + 1, STEP_REVIEW))
  }

  const goBack = () =>
    setStep((s) => {
      const index = steps.findIndex((x) => x.id === s)
      return index > 0 ? steps[index - 1].id : s
    })

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
        // The customer's chosen service - its duration is what determined
        // which days and times were even offered. Null only for a business
        // with nothing configured to book.
        appointment_type_id: data.appointmentTypeId || null,
        preferred_date: data.date,
        preferred_time: data.time || null,
        preferred_employee_note: null,
        answers: toAnswerInput(sections, answers),
        captcha_token: captchaToken,
      })
      setBookingReference(result.booking_reference)
      // The account already exists at this point (see
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
      // their answers and details are untouched.
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
      if (fields.customer_phone) mapped.phone = fields.customer_phone

      // The server rejects configured answers keyed by field id, which is
      // exactly what the form renders from - so they land back on the right
      // controls rather than as one opaque message.
      const configured: Record<string, string> = {}
      for (const [key, message] of Object.entries(fields)) {
        if (answers[key] !== undefined) configured[key] = message
      }
      setAnswerErrors(configured)

      const timeIssue = fields.preferred_date || fields.preferred_time
      const hasFieldIssue =
        Object.keys(mapped).length > 0 || Object.keys(configured).length > 0 || timeIssue
      mapped.form = hasFieldIssue ? 'Please fix the highlighted details.' : errorMessage(err)
      setErrors(mapped)
      if (timeIssue) setStep(STEP_TIME)
      else if (hasFieldIssue) setStep(STEP_DETAILS)
    } finally {
      setSubmitting(false)
    }
  }

  const restart = () => {
    setData(initialData)
    setAnswers(initialAnswers(sections))
    setErrors({})
    setAnswerErrors({})
    setStep(hasServices ? STEP_SERVICE : STEP_TIME)
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

  const selectedService = services.find((s) => s.id === data.appointmentTypeId)
  const showSlotBanner = Boolean(data.date && data.time && step >= STEP_DETAILS)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-500">Book an appointment</p>
        <h1 className="text-xl font-semibold text-slate-900">{garage.name}</h1>
      </div>

      <WizardStepper steps={steps} currentStep={step} />

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        {showSlotBanner && (
          <SelectedSlotBanner
            date={data.date}
            time={data.time}
            onChange={() => goToStep(STEP_TIME)}
          />
        )}

        {/* Keyed on the step so the fade replays on each transition. */}
        <div key={step} className="animate-step-in">
          {step === STEP_SERVICE && (
            <>
              <ServicePicker
                groups={garage.appointment_type_groups}
                services={services}
                businessDisplayMode={garage.booking_display_mode}
                selectedId={data.appointmentTypeId}
                onSelect={selectService}
              />
              <IncludedItems service={selectedService} />
            </>
          )}

          {step === STEP_TIME && (
            <DateTimeStep
              slug={garageSlug}
              date={data.date}
              appointmentTypeId={data.appointmentTypeId}
              selectedService={selectedService}
              time={data.time}
              onSelectDate={selectDate}
              onSelectSlot={selectSlot}
              onChangeService={hasServices ? () => goToStep(STEP_SERVICE) : undefined}
            />
          )}

          {step === STEP_DETAILS && (
            <DetailsStep
              data={data}
              errors={errors}
              update={update}
              sections={sections}
              answers={answers}
              answerErrors={answerErrors}
              onAnswerChange={updateAnswer}
            />
          )}

          {step === STEP_REVIEW && (
            <ReviewStep
              data={data}
              garageName={garage.name}
              appointmentType={selectedService}
              sections={sections}
              answers={answers}
              onEditStep={goToStep}
              onCaptchaToken={handleCaptchaToken}
            />
          )}
        </div>

        {errors.form && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
          {step > steps[0].id ? (
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
            // The service step advances on selection, so it has no Continue
            // button to press - a second click to confirm a choice already
            // made is just friction.
            step !== STEP_SERVICE && (
              <button
                type="button"
                onClick={goNext}
                disabled={step === STEP_TIME && (!data.date || !data.time)}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Continue
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

/** The one service in `groupId`, or undefined when the group holds none or
 * several - a group deep link should narrow the choice, not make it. */
function singleServiceIn(
  services: PublicAppointmentType[],
  groupId: string,
): PublicAppointmentType | undefined {
  const inGroup = services.filter((s) => s.group_id === groupId)
  return inGroup.length === 1 ? inGroup[0] : undefined
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
  appointmentTypeId,
  selectedService,
  time,
  onSelectDate,
  onSelectSlot,
  onChangeService,
}: {
  slug: string
  date: string
  appointmentTypeId: string
  selectedService: PublicAppointmentType | undefined
  time: string
  onSelectDate: (date: string) => void
  onSelectSlot: (time: string) => void
  onChangeService?: () => void
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Pick a date &amp; time</h2>
      {selectedService && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
          <span>
            Booking <span className="font-medium text-slate-900">{selectedService.name}</span>
            {selectedService.default_duration_minutes != null &&
              ` · ${selectedService.default_duration_minutes} min`}
          </span>
          {onChangeService && (
            <button
              type="button"
              onClick={onChangeService}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-800"
            >
              Change
            </button>
          )}
        </p>
      )}
      <p className="mt-1 text-sm text-slate-500">
        Green days have good availability, amber days are filling up, and red days are full.
      </p>
      <div className="mt-4">
        <AvailabilityCalendar
          slug={slug}
          selectedDate={date || null}
          onSelectDate={onSelectDate}
          appointmentTypeId={appointmentTypeId || undefined}
        />
      </div>
      {date && (
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

function DetailsStep({
  data,
  errors,
  update,
  sections,
  answers,
  answerErrors,
  onAnswerChange,
}: {
  data: WizardData
  errors: FieldErrors
  update: (field: keyof WizardData, value: string) => void
  sections: BookingFlowSection[]
  answers: AnswerMap
  answerErrors: Record<string, string>
  onAnswerChange: (fieldId: string, next: AnswerState) => void
}) {
  return (
    <div className="space-y-8">
      {/* Built in and non-removable: without these there is no account to
          attach the booking to and no way to confirm it. */}
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

      {/* Everything this business asks for itself. */}
      {sections.map((section) => (
        <BookingSection
          key={section.id}
          section={section}
          answers={answers}
          errors={answerErrors}
          onChange={onAnswerChange}
        />
      ))}
    </div>
  )
}

function ReviewStep({
  data,
  garageName,
  appointmentType,
  sections,
  answers,
  onEditStep,
  onCaptchaToken,
}: {
  data: WizardData
  garageName: string
  appointmentType: PublicAppointmentType | undefined
  sections: BookingFlowSection[]
  answers: AnswerMap
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

        <SummarySection title="Your details" onEdit={() => onEditStep(STEP_DETAILS)}>
          <SummaryRow label="Name" value={`${data.firstName} ${data.lastName}`.trim()} />
          <SummaryRow label="Email" value={data.email} />
          <SummaryRow label="Mobile number" value={data.phone || '—'} />
        </SummarySection>

        {sections.map((section) => (
          <SummarySection
            key={section.id}
            title={section.title}
            onEdit={() => onEditStep(STEP_DETAILS)}
          >
            {section.fields.map((field) => {
              const answer = answers[field.id]
              const shown =
                field.field_type === 'MULTI_SELECT'
                  ? (answer?.values ?? []).join(', ')
                  : (answer?.value ?? '')
              return (
                <SummaryRow
                  key={field.id}
                  label={field.label}
                  value={shown.trim() || 'Not provided'}
                />
              )
            })}
          </SummarySection>
        ))}
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
