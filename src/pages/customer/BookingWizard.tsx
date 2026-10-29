import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
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
import {
  BookingSummaryBar,
  SUMMARY_BAR_RESERVED_SPACE,
} from '../../components/customer/BookingSummaryBar'
import {
  BookingSummaryOverlay,
  bookingTotals,
  SUMMARY_OVERLAY_RESERVED_SPACE,
} from '../../components/customer/BookingSummaryOverlay'
import { formatTimeRange, serviceMinutes } from '../../lib/availability'
import { formatLongDate } from '../../lib/datetime'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useBookingFlow, usePublicGarage } from '../../api/queries'
import {
  abandonDepositAttempt,
  DISCOUNT_CODE_INVALID,
  recoverDepositAttempt,
  submitBookingRequest,
  type DiscountValidation,
  type BookingFlowSection,
  type BookingRequestInput,
  type DepositIntentCreated,
  type RecoveredDepositAttempt,
  type PublicAppointmentType,
} from '../../api/publicGarage'
import { useCustomerAuth } from '../../auth/CustomerAuthContext'
import { Captcha, captchaEnabled } from '../../components/Captcha'
import { isPlausibleUkMobile } from '../../lib/phone'
import { RichTextInput } from '../../components/rich/RichTextInput'
import { DepositStep } from '../../components/customer/DepositStep'
import { DiscountCodeField } from '../../components/customer/DiscountCodeField'
import { TermsAcceptance } from '../../components/customer/TermsAcceptance'
import { TERMS_VERSION_MISMATCH } from '../../api/terms'
import {
  addOnTotals,
  formatPence,
  selectionToPayload,
  selectionToQuery,
  toPence,
  type AddOnSelection,
} from '../../lib/addOns'

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
  /** The server's end for the chosen slot (see AvailabilitySlot.end); only
   * meaningful while `time` is set. */
  timeEnd: string
  paymentAttemptId: string
}

const initialData: WizardData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  date: '',
  appointmentTypeId: '',
  time: '',
  timeEnd: '',
  paymentAttemptId: '',
}

function recoveryStorageKey(garageId: string): string {
  return `comaz:public-booking-recovery:${garageId}`
}

/** "09:00" + 90 -> "10:30" - the expected finish time shown on review. */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = Math.floor((total % (24 * 60)) / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Fallback finish time when the server's slot `end` isn't known (a resumed
 * deposit attempt): start plus the same duration availability used. */
function reviewFinishTime(
  data: WizardData,
  service: PublicAppointmentType | undefined,
  selection: AddOnSelection,
): string | null {
  const minutes = service ? serviceMinutes(service) : null
  if (!data.time || minutes == null) return null
  return addMinutesToTime(data.time, minutes + addOnTotals(selection, service?.add_ons ?? []).minutes)
}

type FieldErrors = Partial<Record<keyof WizardData, string>> & { form?: string }

// A plain sequence of keys, not fixed numeric ids: whether 'deposit' is
// present depends on the selected service (see `steps` below), so the
// step *number* shown in the stepper has to come from each step's position
// in that list, not a hard-coded constant - otherwise turning a deposit on
// mid-flow would leave "Step 3 of 3" stuck showing the wrong total.
type StepKey = 'service' | 'time' | 'details' | 'review'

const STEP_LABELS: Record<StepKey, string> = {
  service: 'Service',
  time: 'Date & time',
  // No longer "Vehicle & your details": what is asked beyond name and contact
  // details is the business's own configuration now.
  details: 'Your details',
  review: 'Review',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [recoveredIntent, setRecoveredIntent] = useState<DepositIntentCreated | null>(null)
  const [recoveryChecked, setRecoveryChecked] = useState(false)
  const [addOnSelection, setAddOnSelection] = useState<AddOnSelection>({})
  // The business's Terms & Conditions, accepted on Review. Sent with whichever
  // call creates the booking request - the plain submit, or the deposit
  // intent - and enforced server-side either way.
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsError, setTermsError] = useState<string | undefined>()
  // A discount code the server has accepted for this exact booking (service,
  // add-ons, email). Cleared whenever any of those change, since the server
  // must check it again; the server re-checks it on submit regardless.
  const [discount, setDiscount] = useState<DiscountValidation | null>(null)
  const [discountNotice, setDiscountNotice] = useState<string | null>(null)
  // Bumped to remount the Deposit step with a fresh payment attempt - its
  // hold is created at one price, so a code change needs a new one.
  const [depositAttempt, setDepositAttempt] = useState(0)

  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), [])
  const persistRecoveryToken = useCallback((token: string) => {
    if (!urlGarageId) return
    try { sessionStorage.setItem(recoveryStorageKey(urlGarageId), token) } catch { /* optional UX */ }
  }, [urlGarageId])
  const clearRecoveryToken = useCallback(() => {
    if (!urlGarageId) return
    try { sessionStorage.removeItem(recoveryStorageKey(urlGarageId)) } catch { /* optional UX */ }
  }, [urlGarageId])

  const clearDiscount = () => {
    setDiscount(null)
    setDiscountNotice(null)
  }

  const update = (field: keyof WizardData, value: string) => {
    setData((d) => ({ ...d, [field]: value, paymentAttemptId: '' }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
    // Loyalty codes belong to one customer, matched by email.
    if (field === 'email') clearDiscount()
  }

  const selectDate = (date: string) => {
    // The chosen service persists across a date change (still driving
    // duration once a new time is picked) - only the stale time resets.
    setData((d) => ({ ...d, date, time: '', paymentAttemptId: '' }))
    setErrors((e) => ({ ...e, form: undefined }))
  }

  const selectService = (appointmentTypeId: string) => {
    // Duration drives which days and times are even offered, so a service
    // change invalidates any date/time already picked.
    setData((d) => ({ ...d, appointmentTypeId, date: '', time: '', paymentAttemptId: '' }))
    setErrors({})
    if (appointmentTypeId !== data.appointmentTypeId) {
      setAddOnSelection({})
      clearDiscount()
    }
    // Never navigates: picking reveals the summary overlay, whose Next is
    // the only way on - so add-ons (which change the job's length, and so
    // which slots fit) are always in view before the calendar.
  }

  const changeAddOns = (next: AddOnSelection) => {
    setAddOnSelection(next)
    clearDiscount()
    // Same reason as a service change: a different duration can make the
    // chosen day/time no longer fit.
    setData((d) => ({ ...d, date: '', time: '', paymentAttemptId: '' }))
  }

  const updateAnswer = (fieldId: string, next: AnswerState) => {
    setAnswers((a) => ({ ...a, [fieldId]: next }))
    setAnswerErrors((e) => (e[fieldId] ? { ...e, [fieldId]: '' } : e))
  }

  const selectSlot = (time: string, end?: string) => {
    setData((d) => ({ ...d, time, timeEnd: end ?? '', paymentAttemptId: '' }))
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
  // No terms entered (or whitespace only, which the server stores as none) =
  // no checkbox and nothing sent.
  const terms = garage?.terms_and_conditions?.trim() ? garage.terms_and_conditions : null
  const termsVersion = terms ? (garage?.terms_version ?? null) : null
  const changeTermsAccepted = (accepted: boolean) => {
    setTermsAccepted(accepted)
    if (accepted) setTermsError(undefined)
  }
  // The server rejected the version the customer ticked: the business edited
  // its terms mid-booking. Fetch the new wording and ask again, rather than
  // ever accepting words the customer hasn't seen.
  const handleTermsChanged = () => {
    void queryClient.invalidateQueries({ queryKey: ['publicGarage', urlGarageId] })
    setTermsAccepted(false)
    setTermsError(undefined)
    setErrors({ form: 'The terms were updated. Please read and accept the latest version.' })
    setStep('review')
  }
  const termsPayload = { termsAccepted: Boolean(terms) && termsAccepted, termsVersion }
  const hasServices = services.length > 0
  const selectedAppointmentType = services.find((t) => t.id === data.appointmentTypeId)
  const requiresDeposit = selectedAppointmentType?.deposit_required ?? false
  // A code that makes the booking free skips the deposit entirely - it goes
  // through as an ordinary booking (the server agrees: see
  // app/public_booking/routes.py::BookingRequestSubmit).
  const needsDeposit = requiresDeposit && !(discount && !discount.deposit_required)
  const availableAddOns = selectedAppointmentType?.add_ons ?? []
  const addOnsQuery = selectionToQuery(addOnSelection)

  // Server state wins over a browser draft.  In particular, ordinary
  // availability must not be consulted first: a customer's own valid hold
  // correctly makes that slot unavailable to everyone else.
  //
  // The token can also arrive via ?resume=<token> - the SMS deposit link a
  // voice booking sends (app/ai_voice/tools.py::_create_deposit_booking)
  // points straight at /book/<garageId>?resume=<token> rather than a
  // separate resume page, so this is the only place that flow needs. It is
  // persisted to sessionStorage exactly like a same-browser deposit attempt
  // so a refresh keeps working, then stripped from the visible URL.
  useEffect(() => {
    if (recoveryChecked || !urlGarageId || !garageSlug) return
    let token: string | null = searchParams.get('resume')
    if (token) {
      persistRecoveryToken(token)
      setSearchParams(
        (params) => {
          params.delete('resume')
          return params
        },
        { replace: true },
      )
    } else {
      try { token = sessionStorage.getItem(recoveryStorageKey(urlGarageId)) } catch { /* optional UX */ }
    }
    if (!token) { setRecoveryChecked(true); return }
    let cancelled = false
    recoverDepositAttempt(garageSlug, token)
      .then((attempt: RecoveredDepositAttempt) => {
        if (cancelled) return
        if (attempt.status === 'EXPIRED' || !attempt.appointment_type_id) {
          clearRecoveryToken()
          setErrors({ form: 'Your reservation expired before payment completed. Please choose another time.' })
          setStep('time')
          return
        }
        setData({
          firstName: attempt.customer_first_name,
          lastName: attempt.customer_last_name,
          email: attempt.customer_email ?? '',
          phone: attempt.customer_phone ?? '',
          date: attempt.preferred_date,
          time: attempt.preferred_time ?? '',
          // Not part of a recovered attempt; Review falls back to the
          // service's duration.
          timeEnd: '',
          appointmentTypeId: attempt.appointment_type_id,
          paymentAttemptId: '',
        })
        setAddOnSelection(
          Object.fromEntries(
            (attempt.add_ons ?? [])
              .filter((a) => a.add_on_id)
              .map((a) => [a.add_on_id as string, a.quantity]),
          ),
        )
        setAnswers(Object.fromEntries(attempt.answers.map((answer) => [answer.field_id, {
          value: answer.value ?? '', values: answer.values,
        }])))
        setBookingReference(attempt.booking_reference)
        if (attempt.status === 'PENDING' && attempt.payment_status === 'SUCCEEDED') {
          clearRecoveryToken()
          setDepositResult(attempt)
          setSubmitted(true)
        } else if (attempt.status === 'AWAITING_PAYMENT' && attempt.provider_data) {
          setRecoveredIntent(attempt)
          setStep('review')
        } else {
          clearRecoveryToken()
          setErrors({ form: 'This payment attempt can no longer be resumed. Please choose another time.' })
          setStep('time')
        }
      })
      .catch(() => {
        // An invalid/expired capability deliberately reveals nothing. Drop it
        // and leave a normal fresh booking journey available.
        clearRecoveryToken()
      })
      .finally(() => { if (!cancelled) setRecoveryChecked(true) })
    return () => { cancelled = true }
  }, [
    recoveryChecked,
    urlGarageId,
    garageSlug,
    clearRecoveryToken,
    persistRecoveryToken,
    searchParams,
    setSearchParams,
  ])

  // Two steps are conditional, for the same reason: the Service step only
  // exists when there is something to choose between, and the Deposit step
  // only when the chosen service requires one. Everything else - numbering,
  // Back/Continue, the stepper - derives from this one list.
  const steps: StepKey[] = [
    ...(hasServices ? (['service'] as StepKey[]) : []),
    'time',
    'details',
    'review',
  ]
  /**
   * Deep link: /book/<id>?service=<id> or ?group=<id>.
   *
   * A business can put a button on its own site ("Book an MOT") that lands
   * the customer with that service already chosen. It preselects - opening
   * its group and showing the summary overlay - but never skips the overlay:
   * Next there is the one way on, so price, time and add-ons are always seen
   * first. Applied once, before first paint.
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

    if (target) setData((d) => ({ ...d, appointmentTypeId: target.id }))
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
    // makes (submitting directly, or creating a deposit intent from Review).
    if (step === 'details' && captchaEnabled && !captchaToken) {
      setErrors({ form: 'Please confirm that you are not a robot.' })
      return
    }
    if (step === 'details' && requiresDeposit && !data.paymentAttemptId) {
      setData((d) => ({ ...d, paymentAttemptId: crypto.randomUUID() }))
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
    clearRecoveryToken()
    setStep('review')
  }

  // The payment hold expired (or the slot was otherwise lost) while paying -
  // the booking never went through, so there is nothing to keep: send the
  // customer back to pick a fresh slot rather than showing a dead-end error.
  const handleDepositSlotLost = () => {
    setDepositResult(null)
    setRecoveredIntent(null)
    clearRecoveryToken()
    setData((d) => ({ ...d, time: '', paymentAttemptId: '' }))
    refreshAvailability()
    setErrors({
      form: 'Your payment window expired before it completed, so this slot was released. Please choose another time.',
    })
    setStep('time')
  }

  /** Switch the booking to a new discount (or none). A deposit booking's
   * payment hold was created at the old price, so give it up first and let
   * the Deposit step start a fresh attempt - refusing (and keeping the old
   * price) if that payment has already gone through or is being confirmed. */
  const switchDiscount = async (next: DiscountValidation | null): Promise<boolean> => {
    setDiscountNotice(null)
    if (requiresDeposit && !depositResult) {
      let token: string | null = null
      try { token = urlGarageId ? sessionStorage.getItem(recoveryStorageKey(urlGarageId)) : null } catch { /* optional UX */ }
      if (token) {
        try {
          await abandonDepositAttempt(garageSlug, token)
        } catch (err) {
          if (isApiError(err) && err.code === 409) {
            setDiscountNotice(errorMessage(err))
            return false
          }
          // 404: nothing left to give up (it expired, or never got made).
        }
        clearRecoveryToken()
      }
      setRecoveredIntent(null)
      setData((d) => ({ ...d, paymentAttemptId: crypto.randomUUID() }))
      setDepositAttempt((n) => n + 1)
    }
    setDiscount(next)
    return true
  }

  /** The server turned the code down at submit time (it expired, or was
   * used, since it was applied): drop it, show why, and show the full price
   * rather than failing silently. */
  const handleDiscountRejected = (message: string) => {
    setDiscount(null)
    setDiscountNotice(
      `${message} We've removed it, so the full price is shown below - please check it before you continue.`,
    )
    if (requiresDeposit) {
      setData((d) => ({ ...d, paymentAttemptId: crypto.randomUUID() }))
      setDepositAttempt((n) => n + 1)
    }
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
    if (terms && !termsAccepted) {
      setTermsError('Please accept the terms and conditions to continue.')
      return
    }
    setSubmitting(true)
    setErrors({})
    try {
      const email = data.email.trim()
      const result = await submitBookingRequest(
        garageSlug,
        buildBookingPayload(
          data,
          captchaToken,
          sections,
          answers,
          addOnSelection,
          termsPayload,
          discount?.code,
        ),
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
      if (isApiError(err) && err.code === 409 && err.reason === TERMS_VERSION_MISMATCH) {
        handleTermsChanged()
        return
      }
      if (isApiError(err) && err.reason === DISCOUNT_CODE_INVALID) {
        handleDiscountRejected(errorMessage(err))
        return
      }
      // The slot was taken between loading the calendar and submitting.
      if (isApiError(err) && err.code === 409) {
        setData((d) => ({ ...d, time: '', paymentAttemptId: '' }))
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
      if (fields.terms_accepted) setTermsError(fields.terms_accepted)
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
    setAddOnSelection({})
    setErrors({})
    setStep('time')
    setSubmitted(false)
    setBookingReference(null)
    setDepositResult(null)
    setCaptchaToken('')
    setTermsAccepted(false)
    setTermsError(undefined)
    clearDiscount()
  }

  if (submitted) {
    return (
      <ConfirmationScreen
        firstName={data.firstName}
        date={data.date}
        time={formatTimeRange(data.time, data.timeEnd || reviewFinishTime(data, selectedAppointmentType, addOnSelection))}
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
    return <p className="mx-auto max-w-2xl text-sm text-page-muted">Loading…</p>
  }
  if (!garage) {
    return (
      <GarageNotice
        title="Business not found"
        body="We couldn't find that business — check the booking link the business gave you."
      />
    )
  }

  const showSummaryOverlay = step === 'service' && selectedAppointmentType !== undefined
  // The later steps' slim bar - replaces the old "Your selected time" banner.
  const showSummaryBar = step !== 'service' && selectedAppointmentType !== undefined
  const termsBlocking = Boolean(terms && !termsAccepted && !depositResult)
  // The step's forward action, carried by the summary bar. A deposit
  // booking's Review has none until the deposit is confirmed - the payment
  // form in the card is the next move (see DepositStep).
  const barAction =
    step === 'review'
      ? !needsDeposit || depositResult
        ? {
            // Deposit bookings only reach here once the server has confirmed
            // the deposit succeeded (see handleDepositPaid).
            label: submitting ? 'Confirming…' : 'Confirm Booking',
            onClick: handleSubmit,
            disabled: submitting,
            softDisabled: termsBlocking,
            confirm: true,
          }
        : undefined
      : {
          label: 'Next',
          onClick: goNext,
          disabled: step === 'time' && (!data.date || !data.time),
          arrow: true,
        }
  const totals = selectedAppointmentType
    ? bookingTotals(selectedAppointmentType, availableAddOns, addOnSelection)
    : null

  return (
    <div
      className={`mx-auto max-w-2xl ${
        // Date & time widens on large screens - past the page column, which
        // has the room to spare - so the times can sit beside a full-size
        // calendar instead of squeezing it. CSS only, like every breakpoint.
        step === 'time' ? 'lg:-mx-32 lg:max-w-none xl:-mx-44' : ''
      }`}
    >
      <div className="mb-6 flex items-center gap-3">
        <BusinessBrandMark name={garage.name} logoUrl={garage.logo_url} />
        <div>
          <p className="text-sm font-medium text-page-muted">Book an appointment</p>
          <h1 className="font-display text-xl font-semibold tracking-tight text-page-strong">{garage.name}</h1>
        </div>
      </div>

      <WizardStepper steps={wizardSteps} currentStep={currentStepNumber} />

      <div className="mt-8 rounded-lg bg-white shadow-card p-6">
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
            addOns={addOnsQuery}
            time={data.time}
            onSelectDate={selectDate}
            onSelectSlot={selectSlot}
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
        {step === 'review' && (
          <ReviewStep
            data={data}
            garageName={garage.name}
            appointmentType={selectedAppointmentType}
            addOnSelection={addOnSelection}
            depositResult={depositResult}
            sections={sections}
            answers={answers}
            onEditStep={goToStep}
            requiresDeposit={needsDeposit}
            discount={discount}
            discountNotice={discountNotice}
            discountControl={
              // Only while the price can still change: not once a deposit is
              // paid, nor for a resumed checkout (its price is fixed), nor
              // for a service with no price to take a discount off.
              !depositResult && !recoveredIntent && selectedAppointmentType?.base_price != null ? (
                <DiscountCodeField
                  slug={garageSlug}
                  appointmentTypeId={data.appointmentTypeId}
                  customerEmail={data.email.trim()}
                  addOns={selectionToPayload(addOnSelection)}
                  applied={discount}
                  onApply={(result) => switchDiscount(result)}
                  onRemove={() => switchDiscount(null)}
                />
              ) : null
            }
            termsAcceptance={
              // Not once a deposit has been paid, nor for a resumed checkout:
              // acceptance was already recorded when that request was made.
              terms && !depositResult && !recoveredIntent ? (
                <TermsAcceptance
                  terms={terms}
                  garageId={garage.id}
                  accepted={termsAccepted}
                  onChange={changeTermsAccepted}
                  error={termsError}
                  // Ticking it on a deposit booking starts the checkout, which
                  // records the acceptance - it can't be taken back from here.
                  disabled={needsDeposit && termsAccepted}
                />
              ) : null
            }
            paymentCheckout={
              needsDeposit && !depositResult ? (
                // The deposit intent *creates* the booking request, so the box
                // has to be ticked before it is ever requested.
                !terms || termsAccepted || recoveredIntent ? (
                  <DepositStep
                    key={depositAttempt}
                    slug={garageSlug}
                    garageName={garage.name}
                    payload={buildBookingPayload(
                      data,
                      captchaToken,
                      sections,
                      answers,
                      addOnSelection,
                      termsPayload,
                      discount?.code,
                    )}
                    appointmentType={selectedAppointmentType}
                    onDiscountRejected={handleDiscountRejected}
                    onPaid={handleDepositPaid}
                    onSlotLost={handleDepositSlotLost}
                    initialIntent={recoveredIntent}
                    onRecoveryToken={persistRecoveryToken}
                    onTermsChanged={handleTermsChanged}
                  />
                ) : (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Accept the terms and conditions above to continue to payment.
                  </p>
                )
              ) : null
            }
          />
        )}
        </div>

        {errors.form && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>
        )}

        {/* The Service step has no footer: the summary overlay's Next is the
            way on, and there is nothing to go back to. */}
        {step !== 'service' && (
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
          {step !== steps[0] && !(step === 'review' && (depositResult || needsDeposit)) ? (
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
          {showSummaryBar ? (
            // The way on is in the summary bar, with the service and price.
            <span />
          ) : step === 'review' && (!needsDeposit || depositResult) ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              // Looks disabled until the terms are ticked, but stays
              // focusable and clickable so trying anyway explains why.
              aria-disabled={terms && !termsAccepted && !depositResult ? true : undefined}
              className={`rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 ${
                terms && !termsAccepted && !depositResult ? 'opacity-50' : ''
              }`}
            >
              {/* Deposit bookings only ever reach Review once depositResult
                  is set - i.e. once the server has confirmed the deposit
                  succeeded (see handleDepositPaid) - so this button is never
                  enabled here before an authoritative SUCCEEDED status. */}
              {submitting ? 'Confirming…' : 'Confirm Booking'}
            </button>
          ) : step === 'review' ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={step === 'time' && (!data.date || !data.time)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Next
            </button>
          )}
        </div>
        )}
      </div>

      {showSummaryOverlay && (
        <>
          {/* Keeps the last service clear of the collapsed bar. */}
          <div aria-hidden="true" className={SUMMARY_OVERLAY_RESERVED_SPACE} />
          <BookingSummaryOverlay
            // A different service starts with its add-on panel open again.
            key={selectedAppointmentType.id}
            service={selectedAppointmentType}
            addOns={availableAddOns}
            selection={addOnSelection}
            onChangeAddOns={changeAddOns}
            onNext={goNext}
          />
        </>
      )}

      {showSummaryBar && totals && (
        <>
          {/* Keeps the step's own Back / Continue clear of the bar. */}
          <div aria-hidden="true" className={SUMMARY_BAR_RESERVED_SPACE} />
          <BookingSummaryBar
            serviceName={selectedAppointmentType.name}
            // A discount the server accepted is what will be charged.
            pricePence={discount ? toPence(discount.new_total) : totals.pricePence}
            minutes={totals.minutes}
            date={data.time ? data.date : undefined}
            time={data.time || undefined}
            timeEnd={
              data.timeEnd ||
              reviewFinishTime(data, selectedAppointmentType, addOnSelection) ||
              undefined
            }
            // Back to what this step depends on; nothing is changeable once
            // a deposit has been paid.
            {...(depositResult
              ? {}
              : step === 'time'
                ? { onChange: () => goToStep('service'), changeLabel: 'Change service' }
                : { onChange: () => goToStep('time'), changeLabel: 'Change time' })}
            action={barAction}
          />
        </>
      )}
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
  addOnSelection: AddOnSelection,
  { termsAccepted, termsVersion }: { termsAccepted: boolean; termsVersion: number | null },
  discountCode?: string,
): BookingRequestInput {
  return {
    customer_first_name: data.firstName.trim(),
    customer_last_name: data.lastName.trim(),
    customer_email: data.email.trim(),
    // Required (validated above) - the server normalises it to E.164.
    customer_phone: data.phone.trim(),
    appointment_type_id: data.appointmentTypeId || null,
    add_ons: selectionToPayload(addOnSelection),
    preferred_date: data.date,
    preferred_time: data.time || null,
    preferred_employee_note: null,
    // Shared with the deposit path, which passes this same payload to
    // DepositStep - a deposit booking must ask the business's own questions
    // too, not skip them because it happens to be paid for up front.
    answers: toAnswerInput(sections, answers),
    captcha_token: captchaToken,
    payment_attempt_id: data.paymentAttemptId || undefined,
    // Only meaningful (and only checked) when the business has terms.
    ...(termsVersion != null
      ? { terms_accepted: termsAccepted, terms_version: termsVersion }
      : {}),
    // Only the code, never a price: the server re-checks it and prices the
    // booking itself.
    ...(discountCode ? { discount_code: discountCode } : {}),
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
  addOns,
  time,
  onSelectDate,
  onSelectSlot,
}: {
  slug: string
  date: string
  appointmentTypeId: string
  addOns: string
  time: string
  onSelectDate: (date: string) => void
  onSelectSlot: (time: string, end?: string) => void
}) {
  const timesRef = useRef<HTMLDivElement>(null)
  const shownDate = useRef(date)
  // Stacked (narrow) layout: bring the times into view when a day is picked.
  // A no-op when they're already visible beside the calendar, so no
  // breakpoint logic is needed. Not on arrival with a day already chosen.
  useEffect(() => {
    if (!date || date === shownDate.current) return
    shownDate.current = date
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    timesRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [date])
  return (
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Pick a date &amp; time</h2>
      <p className="mt-1 text-sm text-slate-500">
        Green days have good availability, amber days are filling up, and red days are full.
      </p>
      {/* Side by side from lg: (CSS only), where the step widens to give a
          full-size calendar; stacked, as before, below it. */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <AvailabilityCalendar
          slug={slug}
          selectedDate={date || null}
          onSelectDate={onSelectDate}
          appointmentTypeId={appointmentTypeId || undefined}
          addOns={addOns || undefined}
        />
        <div ref={timesRef} className="scroll-mt-4">
          {date ? (
            <TimeSlotPicker
              slug={slug}
              date={date}
              appointmentTypeId={appointmentTypeId || undefined}
              addOns={addOns || undefined}
              selectedTime={time || null}
              onSelectSlot={onSelectSlot}
            />
          ) : (
            <TimesPlaceholder />
          )}
        </div>
      </div>
    </div>
  )
}

/** Holds the times column open beside the calendar before a day is chosen.
 * It only *looks* like it's loading: the skeleton is hidden from assistive
 * tech and the caption is real text, so nothing claims to be busy. Wide
 * screens only - stacked, there's nothing for it to sit beside. */
function TimesPlaceholder() {
  return (
    <div
      className="hidden rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 lg:block"
      data-testid="times-placeholder"
    >
      <div aria-hidden="true" className="space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-md bg-slate-200/70 motion-reduce:animate-none"
          />
        ))}
      </div>
      <p className="mt-3 text-center text-sm text-slate-600">Pick a day to see available times</p>
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
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Your details</h2>
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
  addOnSelection,
  depositResult,
  sections,
  answers,
  onEditStep,
  requiresDeposit,
  discount,
  discountNotice,
  discountControl,
  termsAcceptance,
  paymentCheckout,
}: {
  data: WizardData
  garageName: string
  appointmentType: PublicAppointmentType | undefined
  addOnSelection: AddOnSelection
  depositResult: DepositIntentCreated | null
  sections: BookingFlowSection[]
  answers: AnswerMap
  onEditStep: (step: StepKey) => void
  requiresDeposit: boolean
  discount: DiscountValidation | null
  discountNotice: string | null
  discountControl: ReactNode
  termsAcceptance: ReactNode
  paymentCheckout: ReactNode
}) {
  const catalogue = appointmentType?.add_ons ?? []
  const chosenAddOns = catalogue.filter((a) => addOnSelection[a.id])
  const extra = addOnTotals(addOnSelection, catalogue)
  // The server's own end for the slot; computed only for a resumed payment,
  // which doesn't carry one.
  const finishTime = data.timeEnd || reviewFinishTime(data, appointmentType, addOnSelection)

  // Once a deposit is paid the booking already exists server-side, so nothing
  // here is still editable - every Edit link goes away rather than offering a
  // change that can no longer be made.
  const editable = depositResult === null

  return (
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Review</h2>
      <p className="mt-1 text-sm text-slate-500">
        {depositResult
          ? 'Your deposit is paid. Here is a summary of your booking.'
          : requiresDeposit
            ? 'Review your booking, then pay the required deposit securely below.'
          : 'Please check everything below before you submit.'}
      </p>

      <div className="mt-4 space-y-4">
        <SummarySection
          title="Appointment"
          onEdit={editable ? () => onEditStep('time') : undefined}
        >
          <SummaryRow label="Business" value={garageName} />
          {appointmentType && <SummaryRow label="Service" value={appointmentType.name} />}
          {chosenAddOns.length > 0 && (
            <SummaryRow
              label="Add-ons"
              value={chosenAddOns
                .map((a) => (addOnSelection[a.id] > 1 ? `${addOnSelection[a.id]}× ${a.name}` : a.name))
                .join(', ')}
            />
          )}
          {appointmentType?.base_price != null && !discount && (
            <SummaryRow
              label="Price"
              value={formatPence(toPence(appointmentType.base_price) + extra.pricePence)}
            />
          )}
          {discount && <DiscountBreakdown discount={discount} />}
          <SummaryRow label="Date" value={data.date ? formatLongDate(data.date) : '—'} />
          <SummaryRow
            label="Time"
            value={data.time ? formatTimeRange(data.time, finishTime) : '—'}
          />
        </SummarySection>

        {(discountControl || discountNotice) && (
          <div className="space-y-2">
            {discountNotice && (
              <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {discountNotice}
              </p>
            )}
            {discountControl}
            {discount && !discount.deposit_required && appointmentType?.deposit_required && (
              <p className="text-sm text-slate-600">
                Your discount covers the whole booking, so there's no deposit to pay.
              </p>
            )}
          </div>
        )}

        {depositResult && (
          <SummarySection title="Payment">
            {depositResult.discount_code && depositResult.discount_amount && (
              <SummaryRow
                label={`Discount ${depositResult.discount_code}`}
                value={`−£${depositResult.discount_amount}`}
              />
            )}
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

        {/* Before the payment for a deposit booking (it gates it); after the
            summary for a plain one, right above Confirm Booking. */}
        {termsAcceptance && requiresDeposit && <div className="mt-6">{termsAcceptance}</div>}
        {paymentCheckout && <div className="mt-6">{paymentCheckout}</div>}

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

      {termsAcceptance && !requiresDeposit && <div className="mt-6">{termsAcceptance}</div>}

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

/** Original total struck through, the discount, and what's now due - all
 * as the server worked them out. */
function DiscountBreakdown({ discount }: { discount: DiscountValidation }) {
  return (
    <>
      <div className="flex justify-between gap-4 text-sm">
        <dt className="text-slate-500">Price</dt>
        <dd className="text-right">
          <s className="text-slate-500" aria-label={`was £${discount.original_total}`}>
            £{discount.original_total}
          </s>{' '}
          <span className="font-medium text-slate-900">£{discount.new_total}</span>
        </dd>
      </div>
      <SummaryRow label={`Discount ${discount.code}`} value={`−£${discount.discount_amount}`} />
    </>
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
      <h1 className="font-display text-2xl font-semibold tracking-tight text-page-strong">{title}</h1>
      <p className="mt-2 text-page-subtle">{body}</p>
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
      <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-page-strong">Request received</h1>
      <p className="mt-2 text-page-subtle">
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
          className="bg-page-control rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
