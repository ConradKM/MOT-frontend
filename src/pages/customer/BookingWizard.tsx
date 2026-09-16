import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { WizardStepper, type WizardStep } from '../../components/customer/WizardStepper'
import { AvailabilityCalendar } from '../../components/customer/AvailabilityCalendar'
import { IncludedItems, ServicePicker } from '../../components/customer/ServicePicker'
import {
  BookingSection,
  initialAnswers,
  toAnswerInput,
  validateAnswers,
  type AnswerMap,
  type AnswerState,
} from '../../components/customer/BookingFieldInput'
import { BusinessBrandMark } from '../../components/BusinessBrandMark'
import { TimeSlotPicker } from '../../components/customer/TimeSlotPicker'
import { SelectedSlotBanner } from '../../components/customer/SelectedSlotBanner'
import { formatLongDate } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useBookingFlow, usePublicGarage } from '../../api/queries'
import {
  submitBookingRequest,
  type BookingFlowSection,
  type BookingRequestInput,
  type DepositIntentCreated,
  type PublicAppointmentType,
} from '../../api/publicGarage'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
import { Captcha, captchaEnabled } from '../../components/Captcha'
import { RichTextInput } from '../../components/rich/RichTextInput'
import { DepositStep } from '../../components/customer/DepositStep'

/** What the platform itself needs, and the only thing a business cannot
 * configure away: without these there is no account to attach the booking
 * to, nowhere to send the confirmation, and no reference to look it up with.
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

// A plain sequence of keys, not fixed numeric ids: whether 'deposit' is
// present depends on the selected service (see `steps` below), so the
// step *number* shown in the stepper has to come from each step's position
// in that list, not a hard-coded constant - otherwise turning a deposit on
// mid-flow would leave "Step 3 of 3" stuck showing the wrong total.
type StepKey = 'service' | 'time' | 'details' | 'deposit' | 'review'

const STEP_LABELS: Record<StepKey, string> = {
  service: 'Service',
  time: 'Date & time',
  // No longer "Vehicle & your details": what is asked beyond name and contact
  // details is the business's own configuration now.
  details: 'Your details',
  deposit: 'Deposit',
  review: 'Review',
}

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

/** The one service in `groupId`, or undefined when the group holds none or
 * several - a group deep link should narrow the choice, not make it. */
function singleServiceIn(
  services: PublicAppointmentType[],
  groupId: string,
): PublicAppointmentType | undefined {
  const inGroup = services.filter((s) => s.group_id === groupId)
  return inGroup.length === 1 ? inGroup[0] : undefined
}

export function BookingWizard() {
  const { garageId: urlGarageId } = useParams<{ garageId: string }>()
  const [searchParams] = useSearchParams()
  const {
    data: garage,
    isLoading: garageLoading,
  } = usePublicGarage(urlGarageId)
  const queryClient = useQueryClient()
  const { loginWithReference } = useCustomerAuth()

  const garageSlug = garage?.slug ?? ''

  const [step, setStep] = useState<StepKey>('service')
  const [data, setData] = useState<WizardData>(initialData)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingReference, setBookingReference] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({})
  const [deepLinkApplied, setDeepLinkApplied] = useState(false)
  // Set once the Deposit step's payment has succeeded (server-confirmed via
  // webhook, not just "Stripe didn't error") - the booking request already
  // exists at that point (see app/payments/service.py), so Review just
  // shows a summary and finishes rather than submitting anything again.
  const [depositResult, setDepositResult] = useState<DepositIntentCreated | null>(null)

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

  const selectService = (appointmentTypeId: string) => {
    // Duration drives which days and times are even offered, so a service
    // change invalidates any date/time already picked.
    setData((d) => ({ ...d, appointmentTypeId, date: '', time: '' }))
    setErrors({})
    setStep('time')
  }

  const updateAnswer = (fieldId: string, next: AnswerState) => {
    setAnswers((a) => ({ ...a, [fieldId]: next }))
    setAnswerErrors((e) => (e[fieldId] ? { ...e, [fieldId]: '' } : e))
  }

  const selectSlot = (time: string) => {
    setData((d) => ({ ...d, time }))
    setErrors((e) => ({ ...e, form: undefined }))
    setStep('details')
  }

  const { data: flow } = useBookingFlow(garageSlug, data.appointmentTypeId || undefined)
  const sections: BookingFlowSection[] = useMemo(() => flow?.sections ?? [], [flow])

  // Seed an entry per configured field whenever the workflow changes - which
  // it does when the chosen service has an override of its own.
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

  const services = useMemo(() => garage?.appointment_types ?? [], [garage])
  const hasServices = services.length > 0
  const selectedAppointmentType = services.find((t) => t.id === data.appointmentTypeId)
  const requiresDeposit = selectedAppointmentType?.deposit_required ?? false

  // Two steps are conditional, for the same reason: the Service step only
  // exists when there is something to choose between, and the Deposit step
  // only when the chosen service requires one. Everything else - numbering,
  // Back/Continue, the stepper - derives from this one list.
  const steps: StepKey[] = [
    ...(hasServices ? (['service'] as StepKey[]) : []),
    'time',
    'details',
    ...(requiresDeposit ? (['deposit'] as StepKey[]) : []),
    'review',
  ]
  /**
   * Deep link: /book/<id>?service=<id> or ?group=<id>.
   *
   * A business can put a button on its own site that drops the customer
   * straight onto the date step for one service, rather than back onto a menu
   * they have already chosen from. Applied once, before first paint.
   */
  useEffect(() => {
    if (deepLinkApplied || !hasServices) return

    const serviceParam = searchParams.get('service')
    const groupParam = searchParams.get('group')
    const target = serviceParam
      ? services.find((svc) => svc.id === serviceParam)
      : // A group link narrows the choice; it only auto-selects when the group
        // holds exactly one service, since otherwise there is still a real
        // decision to make.
        groupParam
        ? singleServiceIn(services, groupParam)
        : undefined

    if (target) {
      setData((d) => ({ ...d, appointmentTypeId: target.id }))
      setStep('time')
    }
    setDeepLinkApplied(true)
  }, [deepLinkApplied, hasServices, searchParams, services])

  // A business with nothing bookable has no choice to present; showing an
  // empty first step would be a dead end.
  useEffect(() => {
    if (!garageLoading && garage && !hasServices && step === 'service') setStep('time')
  }, [garage, garageLoading, hasServices, step])

  const wizardSteps: WizardStep[] = steps.map((key, i) => ({ id: i + 1, label: STEP_LABELS[key] }))
  const currentStepNumber = steps.indexOf(step) + 1

  const goNext = () => {
    if (step === 'time') {
      if (!data.date) return setErrors({ form: 'Please choose an available date.' })
      if (!data.time) return setErrors({ form: 'Please choose an available time.' })
    }
    if (step === 'details') {
      const detailErrors = validateYourDetails(data)
      const configuredErrors = validateAnswers(sections, answers)
      if (Object.keys(detailErrors).length > 0 || Object.keys(configuredErrors).length > 0) {
        setErrors({ ...detailErrors, form: 'Please fix the highlighted details.' })
        setAnswerErrors(configuredErrors)
        return
      }
    }
    // Verified once, here, right before the first server call either path
    // makes (submitting directly, or creating a deposit intent) - not on
    // Review, which the deposit path never reaches until after that first
    // call already succeeded.
    if (step === 'details' && captchaEnabled && !captchaToken) {
      setErrors({ form: 'Please confirm that you are not a robot.' })
      return
    }
    setErrors({})
    setAnswerErrors({})
    const idx = steps.indexOf(step)
    setStep(steps[Math.min(idx + 1, steps.length - 1)])
  }

  const goBack = () => {
    const idx = steps.indexOf(step)
    setStep(steps[Math.max(idx - 1, 0)])
  }

  const goToStep = (target: StepKey) => {
    setErrors({})
    setStep(target)
  }

  const handleDepositPaid = (result: DepositIntentCreated) => {
    setDepositResult(result)
    setBookingReference(result.booking_reference)
    setStep('review')
  }

  // The payment hold expired (or the slot was otherwise lost) while paying -
  // the booking never went through, so there is nothing to keep: send the
  // customer back to pick a fresh slot rather than showing a dead-end error.
  const handleDepositSlotLost = () => {
    setDepositResult(null)
    setData((d) => ({ ...d, time: '' }))
    refreshAvailability()
    setErrors({
      form: 'Your payment window expired before it completed, so this slot was released. Please choose another time.',
    })
    setStep('time')
  }

  const refreshAvailability = () => {
    queryClient.invalidateQueries({ queryKey: ['garageAvailability', garageSlug] })
    queryClient.invalidateQueries({ queryKey: ['garageDayAvailability', garageSlug] })
  }

  const handleSubmit = async () => {
    // The deposit flow already created (and paid) the booking request server-
    // side - see handleDepositPaid. Review just finishes; there is nothing
    // left to submit, and definitely nothing to submit a second time.
    if (depositResult) {
      setSubmitted(true)
      return
    }

    if (captchaEnabled && !captchaToken) {
      setErrors({ form: 'Please confirm that you are not a robot.' })
      return
    }
    setSubmitting(true)
    setErrors({})
    try {
      const email = data.email.trim()
      const result = await submitBookingRequest(
        garageSlug,
        buildBookingPayload(data, captchaToken, sections, answers),
      )
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
        setStep('time')
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
      if (fields.customer_phone) mapped.phone = fields.customer_phone

      // The server rejects configured answers keyed by field id, which is
      // what the form renders from - so they land back on the right controls
      // rather than as one opaque message.
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
      if (timeIssue) setStep('time')
      else if (hasFieldIssue) setStep('details')
    } finally {
      setSubmitting(false)
    }
  }

  const restart = () => {
    setData(initialData)
    setErrors({})
    setStep('time')
    setSubmitted(false)
    setBookingReference(null)
    setDepositResult(null)
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

  const showSlotBanner = Boolean(data.date && data.time && step !== 'time')

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <BusinessBrandMark name={garage.name} logoUrl={garage.logo_url} />
        <div>
          <p className="text-sm font-medium text-slate-500">Book an appointment</p>
          <h1 className="text-xl font-semibold text-slate-900">{garage.name}</h1>
        </div>
      </div>

      <WizardStepper steps={wizardSteps} currentStep={currentStepNumber} />

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        {showSlotBanner && (
          <SelectedSlotBanner
            date={data.date}
            time={data.time}
            onChange={() => goToStep('time')}
          />
        )}

        {/* Keyed on the step so the fade replays on each transition. */}
        <div key={step} className="animate-step-in">
        {step === 'service' && (
          <>
            <ServicePicker
              groups={garage.appointment_type_groups}
              services={services}
              businessDisplayMode={garage.booking_display_mode}
              selectedId={data.appointmentTypeId}
              onSelect={selectService}
            />
            <IncludedItems service={selectedAppointmentType} />
          </>
        )}
        {step === 'time' && (
          <DateTimeStep
            slug={garageSlug}
            date={data.date}
            appointmentTypeId={data.appointmentTypeId}
            selectedService={selectedAppointmentType}
            time={data.time}
            onSelectDate={selectDate}
            onSelectSlot={selectSlot}
            onChangeService={hasServices ? () => goToStep('service') : undefined}
          />
        )}
        {step === 'details' && (
          <DetailsStep
            data={data}
            errors={errors}
            update={update}
            sections={sections}
            answers={answers}
            answerErrors={answerErrors}
            onAnswerChange={updateAnswer}
            onCaptchaToken={handleCaptchaToken}
          />
        )}
        {step === 'deposit' && (
          <DepositStep
            slug={garageSlug}
            garageName={garage.name}
            payload={buildBookingPayload(data, captchaToken, sections, answers)}
            appointmentType={selectedAppointmentType}
            onPaid={handleDepositPaid}
            onSlotLost={handleDepositSlotLost}
          />
        )}
        {step === 'review' && (
          <ReviewStep
            data={data}
            garageName={garage.name}
            appointmentType={selectedAppointmentType}
            depositResult={depositResult}
            sections={sections}
            answers={answers}
            onEditStep={goToStep}
          />
        )}
        </div>

        {errors.form && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
          {step !== steps[0] && step !== 'deposit' && !(step === 'review' && depositResult) ? (
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
          {step === 'deposit' ? (
            <span />
          ) : step === 'review' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {/* Deposit bookings only ever reach Review once depositResult
                  is set - i.e. once the server has confirmed the deposit
                  succeeded (see handleDepositPaid) - so this button is never
                  enabled here before an authoritative SUCCEEDED status. */}
              {submitting ? 'Confirming…' : 'Confirm Booking'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={step === 'time' && (!data.date || !data.time)}
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

/** Shared between the plain submit path and the deposit-intent creation
 * call - same customer/vehicle/slot payload either way (see
 * app/public_booking/routes.py::_build_booking_request). */
function buildBookingPayload(
  data: WizardData,
  captchaToken: string,
  sections: BookingFlowSection[],
  answers: AnswerMap,
): BookingRequestInput {
  return {
    customer_first_name: data.firstName.trim(),
    customer_last_name: data.lastName.trim(),
    customer_email: data.email.trim(),
    // Required (validated above) - the server normalises it to E.164.
    customer_phone: data.phone.trim(),
    appointment_type_id: data.appointmentTypeId || null,
    preferred_date: data.date,
    preferred_time: data.time || null,
    preferred_employee_note: null,
    // Shared with the deposit path, which passes this same payload to
    // DepositStep - a deposit booking must ask the business's own questions
    // too, not skip them because it happens to be paid for up front.
    answers: toAnswerInput(sections, answers),
    captcha_token: captchaToken,
  }
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
  onCaptchaToken,
}: {
  data: WizardData
  errors: FieldErrors
  update: (field: keyof WizardData, value: string) => void
  sections: BookingFlowSection[]
  answers: AnswerMap
  answerErrors: Record<string, string>
  onAnswerChange: (fieldId: string, next: AnswerState) => void
  onCaptchaToken: (token: string) => void
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

      {/* Verified here rather than on Review: the deposit path makes its
          first server call on leaving this step and never reaches Review
          until that call has already succeeded. */}
      {captchaEnabled && (
        <section>
          <Field label="Verification" required>
            {() => <Captcha onToken={onCaptchaToken} />}
          </Field>
        </section>
      )}
    </div>
  )
}

function ReviewStep({
  data,
  garageName,
  appointmentType,
  depositResult,
  sections,
  answers,
  onEditStep,
}: {
  data: WizardData
  garageName: string
  appointmentType: PublicAppointmentType | undefined
  depositResult: DepositIntentCreated | null
  sections: BookingFlowSection[]
  answers: AnswerMap
  onEditStep: (step: StepKey) => void
}) {
  const finishTime =
    data.time && appointmentType?.default_duration_minutes != null
      ? addMinutesToTime(data.time, appointmentType.default_duration_minutes)
      : null

  // Once a deposit is paid the booking already exists server-side, so nothing
  // here is still editable - every Edit link goes away rather than offering a
  // change that can no longer be made.
  const editable = depositResult === null

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Review</h2>
      <p className="mt-1 text-sm text-slate-500">
        {depositResult
          ? 'Your deposit is paid. Here is a summary of your booking.'
          : 'Please check everything below before you submit.'}
      </p>

      <div className="mt-4 space-y-4">
        <SummarySection
          title="Appointment"
          onEdit={editable ? () => onEditStep('time') : undefined}
        >
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

        {depositResult && (
          <SummarySection title="Payment">
            <SummaryRow
              label="Service total"
              value={depositResult.service_total ? `£${depositResult.service_total}` : '—'}
            />
            <SummaryRow
              label="Deposit paid"
              value={depositResult.deposit_amount ? `£${depositResult.deposit_amount}` : '—'}
            />
            <SummaryRow
              label="Left to pay"
              value={depositResult.remaining_balance ? `£${depositResult.remaining_balance}` : '—'}
            />
          </SummarySection>
        )}

        <SummarySection
          title="Your details"
          onEdit={editable ? () => onEditStep('details') : undefined}
        >
          <SummaryRow label="Name" value={`${data.firstName} ${data.lastName}`.trim()} />
          <SummaryRow label="Email" value={data.email} />
          <SummaryRow label="Mobile number" value={data.phone || '—'} />
        </SummarySection>

        {sections.map((section) => (
          <SummarySection
            key={section.id}
            title={section.title}
            onEdit={editable ? () => onEditStep('details') : undefined}
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
        {depositResult
          ? `${garageName} will be in touch at ${data.email || 'the email you gave'} to confirm.`
          : `Submitting sends a request to ${garageName}. They'll review it and be in touch at ${
              data.email || 'the email you gave'
            } to confirm.`}
      </p>
    </div>
  )
}

function SummarySection({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit?: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Edit
          </button>
        )}
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
