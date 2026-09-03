import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { WizardStepper, type WizardStep } from '../../components/customer/WizardStepper'
import { todayIso } from '../../lib/datetime'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { usePublicGarage, usePublicGarageBySlug, usePublicGarages } from '../../api/queries'
import { submitBookingRequest } from '../../api/publicGarage'
import type { PublicAppointmentType, PublicGarage } from '../../api/publicGarage'
import { Captcha, captchaEnabled } from '../../components/Captcha'
import { RichDropdown } from '../../components/rich/RichDropdown'
import { RichStaticField } from '../../components/rich/RichStaticField'
import { RichTextInput } from '../../components/rich/RichTextInput'
import { richFieldBoxClass, richFieldFocusClass } from '../../components/rich/richFieldStyles'

interface WizardData {
  garageSlug: string
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
  preferredMechanic: string
  appointmentTypeId: string
  notes: string
}

const initialData: WizardData = {
  garageSlug: '',
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
  preferredMechanic: '',
  appointmentTypeId: '',
  notes: '',
}

type FieldErrors = Partial<Record<keyof WizardData, string>> & { form?: string }

const STEPS: WizardStep[] = [
  { id: 1, label: 'Customer Details' },
  { id: 2, label: 'Vehicle Details' },
  { id: 3, label: 'Appointment' },
  { id: 4, label: 'Confirm' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateStep1(d: WizardData): FieldErrors {
  const errors: FieldErrors = {}
  if (!d.garageSlug) errors.garageSlug = 'Please choose a garage.'
  if (!d.firstName.trim()) errors.firstName = 'First name is required.'
  if (!d.lastName.trim()) errors.lastName = 'Last name is required.'
  if (!d.email.trim()) errors.email = 'Email is required.'
  else if (!EMAIL_RE.test(d.email)) errors.email = 'Enter a valid email address.'
  return errors
}

function validateStep2(d: WizardData): FieldErrors {
  const errors: FieldErrors = {}
  if (!d.registration.trim()) errors.registration = 'Registration number is required.'
  if (d.year && (Number(d.year) < 1900 || Number(d.year) > new Date().getFullYear() + 1)) {
    errors.year = 'Enter a valid year.'
  }
  if (d.mileage && Number(d.mileage) < 0) errors.mileage = 'Mileage cannot be negative.'
  return errors
}

function validateStep3(d: WizardData): FieldErrors {
  const errors: FieldErrors = {}
  if (!d.date) errors.date = 'Please choose a date.'
  if (!d.time) errors.time = 'Please choose a time.'
  return errors
}

export function BookingWizard() {
  const { garageId: urlGarageId } = useParams<{ garageId: string }>()
  const { data: urlGarage, isLoading: urlGarageLoading } = usePublicGarage(urlGarageId)
  const {
    data: garages,
    isLoading: garagesLoading,
    isError: garagesError,
  } = usePublicGarages(!urlGarageId)

  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(initialData)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')

  // If a garage id is in the URL, resolve it to a slug once it loads.
  useEffect(() => {
    if (urlGarage?.slug) setData((d) => ({ ...d, garageSlug: urlGarage.slug }))
  }, [urlGarage?.slug])

  const { data: garageDetail } = usePublicGarageBySlug(data.garageSlug || undefined)
  const appointmentTypes = garageDetail?.appointment_types ?? []

  const handleCaptchaToken = useCallback((token: string) => setCaptchaToken(token), [])

  const update = (field: keyof WizardData, value: string) => {
    setData((d) => ({ ...d, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const goNext = () => {
    const stepErrors =
      step === 1
        ? validateStep1(data)
        : step === 2
          ? validateStep2(data)
          : step === 3
            ? validateStep3(data)
            : {}
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setStep((s) => Math.min(s + 1, STEPS.length))
  }

  const goBack = () => setStep((s) => Math.max(s - 1, 1))

  const goToStep = (target: number) => {
    setErrors({})
    setStep(target)
  }

  const handleSubmit = async () => {
    if (captchaEnabled && !captchaToken) {
      setErrors({ form: 'Please complete the verification challenge.' })
      return
    }
    setSubmitting(true)
    setErrors({})
    try {
      await submitBookingRequest(data.garageSlug, {
        customer_first_name: data.firstName.trim(),
        customer_last_name: data.lastName.trim(),
        customer_email: data.email.trim(),
        customer_phone: data.phone.trim() || null,
        vehicle_registration: data.registration.trim(),
        vehicle_make: data.make.trim() || null,
        vehicle_model: data.model.trim() || null,
        vehicle_year: data.year ? Number(data.year) : null,
        vehicle_mileage: data.mileage ? Number(data.mileage) : null,
        appointment_type_id: data.appointmentTypeId || null,
        preferred_date: data.date,
        preferred_time: data.time || null,
        preferred_employee_note: data.preferredMechanic.trim() || null,
        notes: data.notes.trim() || null,
        captcha_token: captchaToken,
      })
      setSubmitted(true)
    } catch (err) {
      const fields = fieldErrors(err)
      // Map snake_case API field names back onto the wizard's fields where it matters.
      const mapped: FieldErrors = {}
      if (fields.customer_email) mapped.email = fields.customer_email
      if (fields.vehicle_registration) mapped.registration = fields.vehicle_registration
      if (fields.preferred_date) mapped.date = fields.preferred_date
      mapped.form =
        Object.keys(mapped).length > 0 ? 'Please fix the highlighted fields.' : errorMessage(err)
      setErrors(mapped)
      // Jump back to the earliest step with an error.
      if (mapped.email) setStep(1)
      else if (mapped.registration) setStep(2)
      else if (mapped.date) setStep(3)
    } finally {
      setSubmitting(false)
    }
  }

  const restart = () => {
    setData(initialData)
    setErrors({})
    setStep(1)
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

  return (
    <div className="mx-auto max-w-2xl">
      <WizardStepper steps={STEPS} currentStep={step} />

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        {step === 1 && (
          <CustomerDetailsStep
            data={data}
            errors={errors}
            update={update}
            urlGarage={urlGarageId ? { garage: urlGarage, loading: urlGarageLoading } : null}
            garages={garages}
            garagesLoading={garagesLoading}
            garagesError={garagesError}
          />
        )}
        {step === 2 && <VehicleDetailsStep data={data} errors={errors} update={update} />}
        {step === 3 && (
          <AppointmentStep
            data={data}
            errors={errors}
            update={update}
            appointmentTypes={appointmentTypes}
            onCaptchaToken={handleCaptchaToken}
          />
        )}
        {step === 4 && (
          <SummaryStep data={data} appointmentTypes={appointmentTypes} onEditStep={goToStep} />
        )}

        {errors.form && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
          {step > 1 ? (
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
          {step < STEPS.length ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Confirm booking request'}
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
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

interface CustomerDetailsStepProps extends StepProps {
  /** Present (non-null) when a garage id came from the URL — fixed, shown as a static field. */
  urlGarage: { garage: PublicGarage | undefined; loading: boolean } | null
  garages: PublicGarage[] | undefined
  garagesLoading: boolean
  garagesError: boolean
}

function CustomerDetailsStep({
  data,
  errors,
  update,
  urlGarage,
  garages,
  garagesLoading,
  garagesError,
}: CustomerDetailsStepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">1. Customer Details</h2>
      <div className="mt-4 space-y-4">
        <Field label="Garage" required error={errors.garageSlug}>
          {urlGarage ? (
            <RichStaticField
              title={urlGarage.garage?.name ?? (urlGarage.loading ? 'Loading…' : undefined)}
              placeholder="Garage not found"
            />
          ) : (
            <RichDropdown
              options={(garages ?? []).map((g) => ({ value: g.slug, title: g.name }))}
              value={data.garageSlug}
              onChange={(value) => update('garageSlug', value)}
              placeholder={
                garagesError
                  ? 'Unable to load garages'
                  : garagesLoading
                    ? 'Loading garages…'
                    : 'Select a garage…'
              }
              disabled={garagesLoading || garagesError || (garages?.length ?? 0) === 0}
              searchable
            />
          )}
        </Field>
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
    </div>
  )
}

function VehicleDetailsStep({ data, errors, update }: StepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">2. Vehicle Details</h2>
      <div className="mt-4 space-y-4">
        <Field label="Registration number" required error={errors.registration}>
          <RichTextInput
            value={data.registration}
            onChange={(v) => update('registration', v.toUpperCase())}
            className="uppercase"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Make" error={errors.make}>
            <RichTextInput value={data.make} onChange={(v) => update('make', v)} />
          </Field>
          <Field label="Model" error={errors.model}>
            <RichTextInput value={data.model} onChange={(v) => update('model', v)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Year" error={errors.year}>
            <RichTextInput type="number" value={data.year} onChange={(v) => update('year', v)} />
          </Field>
          <Field label="Current mileage" error={errors.mileage}>
            <RichTextInput
              type="number"
              min={0}
              value={data.mileage}
              onChange={(v) => update('mileage', v)}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

interface AppointmentStepProps extends StepProps {
  appointmentTypes: PublicAppointmentType[]
  onCaptchaToken: (token: string) => void
}

function AppointmentStep({
  data,
  errors,
  update,
  appointmentTypes,
  onCaptchaToken,
}: AppointmentStepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">3. Appointment</h2>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required error={errors.date}>
            <RichTextInput
              type="date"
              min={todayIso()}
              value={data.date}
              onChange={(v) => update('date', v)}
            />
          </Field>
          <Field label="Time" required error={errors.time}>
            <RichTextInput type="time" value={data.time} onChange={(v) => update('time', v)} />
          </Field>
        </div>

        <Field label="Assigned garage employee/mechanic" error={errors.preferredMechanic}>
          <RichTextInput
            placeholder="No preference"
            value={data.preferredMechanic}
            onChange={(v) => update('preferredMechanic', v)}
          />
          <p className="mt-1 text-xs text-slate-400">
            Optional — let us know if you'd like someone specific, otherwise the garage will assign
            whoever's available.
          </p>
        </Field>

        <Field label="Appointment type" error={errors.appointmentTypeId}>
          {appointmentTypes.length > 0 ? (
            <RichDropdown
              options={[
                { value: '', title: 'Not sure / let the garage decide' },
                ...appointmentTypes.map((t) => ({ value: t.id, title: t.name })),
              ]}
              value={data.appointmentTypeId}
              onChange={(v) => update('appointmentTypeId', v)}
            />
          ) : (
            <RichStaticField placeholder="This garage hasn't published any services yet" />
          )}
        </Field>

        <Field label="Additional notes" error={errors.notes}>
          <textarea
            rows={3}
            value={data.notes}
            onChange={(e) => update('notes', e.target.value)}
            className={`${richFieldBoxClass} ${richFieldFocusClass}`}
          />
        </Field>

        {captchaEnabled && (
          <Field label="Verification" required>
            <Captcha onToken={onCaptchaToken} />
          </Field>
        )}
      </div>
    </div>
  )
}

function SummaryStep({
  data,
  appointmentTypes,
  onEditStep,
}: {
  data: WizardData
  appointmentTypes: PublicAppointmentType[]
  onEditStep: (step: number) => void
}) {
  const typeName =
    appointmentTypes.find((t) => t.id === data.appointmentTypeId)?.name ?? 'Not specified'

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">4. Confirmation</h2>
      <p className="mt-1 text-sm text-slate-500">Please check everything below before you submit.</p>

      <div className="mt-4 space-y-4">
        <SummarySection title="Customer Details" onEdit={() => onEditStep(1)}>
          <SummaryRow label="Name" value={`${data.firstName} ${data.lastName}`.trim()} />
          <SummaryRow label="Email" value={data.email} />
          <SummaryRow label="Phone" value={data.phone || '—'} />
        </SummarySection>

        <SummarySection title="Vehicle Details" onEdit={() => onEditStep(2)}>
          <SummaryRow label="Registration" value={data.registration} />
          <SummaryRow
            label="Make / model"
            value={[data.make, data.model].filter(Boolean).join(' ') || '—'}
          />
          <SummaryRow label="Year" value={data.year || '—'} />
          <SummaryRow label="Current mileage" value={data.mileage || '—'} />
        </SummarySection>

        <SummarySection title="Appointment" onEdit={() => onEditStep(3)}>
          <SummaryRow label="Date" value={data.date} />
          <SummaryRow label="Time" value={data.time} />
          <SummaryRow label="Type" value={typeName} />
          <SummaryRow label="Preferred mechanic" value={data.preferredMechanic || 'No preference'} />
          <SummaryRow label="Notes" value={data.notes || '—'} />
        </SummarySection>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Submitting sends a request to the garage — they'll review it and get back to you to confirm.
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
        Thanks, {firstName}. We've sent your request for {date} at {time}. The garage will review it
        and be in touch at {email} to confirm.
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
