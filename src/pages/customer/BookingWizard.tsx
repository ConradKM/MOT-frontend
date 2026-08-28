import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WizardStepper, type WizardStep } from '../../components/customer/WizardStepper'
import { todayIso } from '../../lib/datetime'

type AppointmentTypeChoice = 'MOT' | 'MOT_AND_SERVICE'

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
  preferredMechanic: string
  appointmentType: AppointmentTypeChoice
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
  preferredMechanic: '',
  appointmentType: 'MOT',
  notes: '',
}

type FieldErrors = Partial<Record<keyof WizardData, string>>

const STEPS: WizardStep[] = [
  { id: 1, label: 'Customer Details' },
  { id: 2, label: 'Vehicle Details' },
  { id: 3, label: 'Appointment' },
  { id: 4, label: 'Confirm' },
]

const appointmentTypeLabels: Record<AppointmentTypeChoice, string> = {
  MOT: 'MOT',
  MOT_AND_SERVICE: 'MOT + Service',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateStep1(d: WizardData): FieldErrors {
  const errors: FieldErrors = {}
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
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(initialData)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const update = (field: keyof WizardData, value: string) => {
    setData((d) => ({ ...d, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const goNext = () => {
    const stepErrors =
      step === 1 ? validateStep1(data) : step === 2 ? validateStep2(data) : step === 3 ? validateStep3(data) : {}
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

  const handleSubmit = () => {
    // There is no public/unauthenticated booking endpoint on the backend — every
    // customer/vehicle/appointment endpoint requires a garage employee's JWT and infers
    // the garage from it (see MOT-frontend/README.md, "Known gap: public booking API").
    // This simulates a successful submission so the intended flow can be reviewed end to
    // end; it does not create a real customer, vehicle, or appointment anywhere.
    console.info('Booking request captured (not sent — no public booking API exists yet):', data)
    setSubmitted(true)
  }

  const restart = () => {
    setData(initialData)
    setErrors({})
    setStep(1)
    setSubmitted(false)
  }

  if (submitted) {
    return <ConfirmationScreen data={data} onRestart={restart} />
  }

  return (
    <div className="mx-auto max-w-2xl">
      <WizardStepper steps={STEPS} currentStep={step} />

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        {step === 1 && <CustomerDetailsStep data={data} errors={errors} update={update} />}
        {step === 2 && <VehicleDetailsStep data={data} errors={errors} update={update} />}
        {step === 3 && <AppointmentStep data={data} errors={errors} update={update} />}
        {step === 4 && <SummaryStep data={data} onEditStep={goToStep} />}

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
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Confirm booking request
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

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'

function CustomerDetailsStep({ data, errors, update }: StepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">1. Customer Details</h2>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" required error={errors.firstName}>
            <input
              value={data.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <input
              value={data.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Email" required error={errors.email}>
          <input
            type="email"
            value={data.email}
            onChange={(e) => update('email', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Phone number" error={errors.phone}>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClass}
          />
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
          <input
            value={data.registration}
            onChange={(e) => update('registration', e.target.value.toUpperCase())}
            className={`${inputClass} uppercase`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Make" error={errors.make}>
            <input value={data.make} onChange={(e) => update('make', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Model" error={errors.model}>
            <input value={data.model} onChange={(e) => update('model', e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Year" error={errors.year}>
            <input
              type="number"
              value={data.year}
              onChange={(e) => update('year', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Current mileage" error={errors.mileage}>
            <input
              type="number"
              min={0}
              value={data.mileage}
              onChange={(e) => update('mileage', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

function AppointmentStep({ data, errors, update }: StepProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">3. Appointment</h2>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required error={errors.date}>
            <input
              type="date"
              min={todayIso()}
              value={data.date}
              onChange={(e) => update('date', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Time" required error={errors.time}>
            <input
              type="time"
              value={data.time}
              onChange={(e) => update('time', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Assigned garage employee/mechanic" error={errors.preferredMechanic}>
          <input
            placeholder="No preference"
            value={data.preferredMechanic}
            onChange={(e) => update('preferredMechanic', e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400">
            Optional — let us know if you'd like someone specific, otherwise the garage will assign
            whoever's available.
          </p>
        </Field>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Appointment type <span className="text-red-500">*</span>
          </label>
          <div className="mt-2 flex gap-4">
            {(['MOT', 'MOT_AND_SERVICE'] as const).map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="appointmentType"
                  checked={data.appointmentType === type}
                  onChange={() => update('appointmentType', type)}
                />
                {appointmentTypeLabels[type]}
              </label>
            ))}
          </div>
        </div>

        <Field label="Additional notes" error={errors.notes}>
          <textarea
            rows={3}
            value={data.notes}
            onChange={(e) => update('notes', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  )
}

function SummaryStep({ data, onEditStep }: { data: WizardData; onEditStep: (step: number) => void }) {
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
          <SummaryRow label="Make / model" value={[data.make, data.model].filter(Boolean).join(' ') || '—'} />
          <SummaryRow label="Year" value={data.year || '—'} />
          <SummaryRow label="Current mileage" value={data.mileage || '—'} />
        </SummarySection>

        <SummarySection title="Appointment" onEdit={() => onEditStep(3)}>
          <SummaryRow label="Date" value={data.date} />
          <SummaryRow label="Time" value={data.time} />
          <SummaryRow label="Type" value={appointmentTypeLabels[data.appointmentType]} />
          <SummaryRow label="Preferred mechanic" value={data.preferredMechanic || 'No preference'} />
          <SummaryRow label="Notes" value={data.notes || '—'} />
        </SummarySection>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        This is a demo booking flow — submitting won't send a real request to the garage yet.
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
        <button type="button" onClick={onEdit} className="text-xs font-medium text-slate-500 hover:text-slate-800">
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

function ConfirmationScreen({ data, onRestart }: { data: WizardData; onRestart: () => void }) {
  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Request received</h1>
      <p className="mt-2 text-slate-600">
        Thanks, {data.firstName}. We've got your request for a {appointmentTypeLabels[data.appointmentType]} on{' '}
        {data.date} at {data.time}. The garage will be in touch at {data.email} to confirm.
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
          to="/customer"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
