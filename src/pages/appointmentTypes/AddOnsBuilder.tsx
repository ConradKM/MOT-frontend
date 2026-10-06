import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useAddOns,
  useAppointmentType,
  useCreateAddOn,
  useDeleteAddOn,
  useUpdateAddOn,
} from '../../api/queries'
import type { AddOnInput } from '../../api/addOns'
import { useGarageId } from '../../hooks/useGarageId'
import { useToast } from '../../components/Toast'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { formatAddOnDelta } from '../../lib/addOns'
import type { AddOn, AppointmentTypeStatus } from '../../types'

const inputClass =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none'

const MAX_QUANTITY_LIMIT = 99

interface FormValues {
  name: string
  description: string
  price_delta: string
  duration_delta_minutes: string
  max_quantity: string
  exclusivity_group: string
  status: AppointmentTypeStatus
}

const emptyForm: FormValues = {
  name: '',
  description: '',
  price_delta: '0.00',
  duration_delta_minutes: '0',
  max_quantity: '1',
  exclusivity_group: '',
  status: 'ACTIVE',
}

function fromAddOn(a: AddOn): FormValues {
  return {
    name: a.name,
    description: a.description ?? '',
    price_delta: a.price_delta,
    duration_delta_minutes: String(a.duration_delta_minutes),
    max_quantity: String(a.max_quantity),
    exclusivity_group: a.exclusivity_group ?? '',
    status: a.status,
  }
}

function validate(v: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!v.name.trim()) errors.name = 'Give the add-on a name.'
  if (v.price_delta.trim() === '' || Number.isNaN(Number(v.price_delta))) {
    errors.price_delta = 'Enter an amount, e.g. 15.00 or -5.00.'
  }
  if (!/^-?\d+$/.test(v.duration_delta_minutes.trim())) {
    errors.duration_delta_minutes = 'Enter whole minutes, e.g. 30 or -15.'
  }
  const qty = Number(v.max_quantity)
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY_LIMIT) {
    errors.max_quantity = `Between 1 and ${MAX_QUANTITY_LIMIT}.`
  }
  return errors
}

function toInput(v: FormValues): AddOnInput {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    price_delta: Number(v.price_delta).toFixed(2),
    duration_delta_minutes: Number(v.duration_delta_minutes),
    max_quantity: Number(v.max_quantity),
    exclusivity_group: v.exclusivity_group.trim() || null,
    status: v.status,
  }
}

function AddOnFields({
  values,
  onChange,
  errors,
  groupListId,
}: {
  values: FormValues
  onChange: (v: FormValues) => void
  errors: Record<string, string>
  groupListId: string
}) {
  const set = (key: keyof FormValues) => (value: string) => onChange({ ...values, [key]: value })
  const field = (key: keyof FormValues, label: string, input: ReactNode, hint?: string) => (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <div className="mt-1">{input}</div>
      {hint && !errors[key] && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {errors[key] && <span className="mt-1 block text-xs text-red-600">{errors[key]}</span>}
    </label>
  )

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field(
        'name',
        'Name',
        <input value={values.name} onChange={(e) => set('name')(e.target.value)} className={inputClass} />,
      )}
      {field(
        'description',
        'Description (optional)',
        <input
          value={values.description}
          onChange={(e) => set('description')(e.target.value)}
          className={inputClass}
        />,
      )}
      {field(
        'price_delta',
        'Price change (£)',
        <input
          inputMode="decimal"
          value={values.price_delta}
          onChange={(e) => set('price_delta')(e.target.value)}
          className={inputClass}
        />,
        'Negative for a discount.',
      )}
      {field(
        'duration_delta_minutes',
        'Time change (minutes)',
        <input
          inputMode="numeric"
          value={values.duration_delta_minutes}
          onChange={(e) => set('duration_delta_minutes')(e.target.value)}
          className={inputClass}
        />,
        'Negative if it shortens the job.',
      )}
      {field(
        'max_quantity',
        'Maximum quantity',
        <input
          type="number"
          min={1}
          max={MAX_QUANTITY_LIMIT}
          value={values.max_quantity}
          onChange={(e) => set('max_quantity')(e.target.value)}
          className={inputClass}
        />,
        '1 = pick once. More shows a quantity stepper.',
      )}
      {field(
        'exclusivity_group',
        'Exclusivity group (optional)',
        <input
          list={groupListId}
          value={values.exclusivity_group}
          onChange={(e) => set('exclusivity_group')(e.target.value)}
          placeholder="e.g. Turnaround"
          className={inputClass}
        />,
        'Only one add-on per group can be picked.',
      )}
      {field(
        'status',
        'Status',
        <select
          value={values.status}
          onChange={(e) => set('status')(e.target.value)}
          className={inputClass}
        >
          <option value="ACTIVE">Active</option>
          <option value="HIDDEN">Hidden</option>
          <option value="DEPRECATED">Deprecated</option>
        </select>,
      )}
    </div>
  )
}

function AddOnRow({
  addOn,
  appointmentTypeId,
  groupListId,
}: {
  addOn: AddOn
  appointmentTypeId: string
  groupListId: string
}) {
  const update = useUpdateAddOn(appointmentTypeId)
  const remove = useDeleteAddOn(appointmentTypeId)
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<FormValues>(() => fromAddOn(addOn))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const handleSave = async () => {
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) return
    try {
      await update.mutateAsync({ id: addOn.id, data: toInput(values) })
      setEditing(false)
      showToast('Add-on saved.', 'success')
    } catch (err) {
      setErrors(fieldErrors(err))
      showToast(errorMessage(err))
    }
  }

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(addOn.id)
      showToast('Add-on removed.', 'success')
    } catch (err) {
      setConfirmingDelete(false)
      showToast(errorMessage(err))
    }
  }

  if (editing) {
    return (
      <li className="rounded-lg bg-white p-4 shadow-card">
        <AddOnFields values={values} onChange={setValues} errors={errors} groupListId={groupListId} />
        <div className="mt-3 flex gap-2 text-sm">
          <button
            type="button"
            onClick={handleSave}
            disabled={update.isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setValues(fromAddOn(addOn))
              setErrors({})
              setEditing(false)
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-card">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">
          {addOn.name}
          {addOn.status !== 'ACTIVE' && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {addOn.status}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {formatAddOnDelta(addOn)}
          {addOn.max_quantity > 1 && ` · up to ${addOn.max_quantity}`}
          {addOn.exclusivity_group && ` · group: ${addOn.exclusivity_group}`}
        </p>
      </div>
      {confirmingDelete ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Remove? Past bookings keep their record.</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={remove.isPending}
            className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {remove.isPending ? 'Removing…' : 'Yes, remove'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-3 text-sm font-medium">
          <button type="button" onClick={() => setEditing(true)} className="text-slate-600 hover:underline">
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      )}
    </li>
  )
}

function AddAddOnForm({
  appointmentTypeId,
  nextOrder,
  groupListId,
}: {
  appointmentTypeId: string
  nextOrder: number
  groupListId: string
}) {
  const create = useCreateAddOn(appointmentTypeId)
  const { showToast } = useToast()
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) return
    try {
      await create.mutateAsync({ ...toInput(values), order: nextOrder })
      setValues(emptyForm)
      showToast('Add-on added.', 'success')
    } catch (err) {
      setErrors(fieldErrors(err))
      showToast(errorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-white p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Add an add-on</h2>
      <AddOnFields values={values} onChange={setValues} errors={errors} groupListId={groupListId} />
      <button
        type="submit"
        disabled={create.isPending}
        className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {create.isPending ? 'Adding…' : 'Add add-on'}
      </button>
    </form>
  )
}

export function AddOnsBuilder() {
  const garageId = useGarageId()
  const { appointmentTypeId } = useParams<{ appointmentTypeId: string }>()
  const { data: appointmentType } = useAppointmentType(appointmentTypeId)
  const { data: addOns, isLoading } = useAddOns(appointmentTypeId)
  const groupListId = 'add-on-groups'
  const groupNames = [...new Set((addOns ?? []).map((a) => a.exclusivity_group).filter(Boolean))]

  return (
    <div className="max-w-2xl">
      <Link
        to={`/${garageId}/settings/appointment-types`}
        className="text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← Back to Appointment Types
      </Link>

      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">
        Add-ons for {appointmentType?.name ?? '…'}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Optional extras staff and customers can pick when booking this service. Each one can
        change the price and the time the job takes. Changes only affect new bookings, not
        existing ones.
      </p>

      <datalist id={groupListId}>
        {groupNames.map((g) => (
          <option key={g} value={g as string} />
        ))}
      </datalist>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

      {addOns && (
        <div className="mt-6 space-y-3">
          {addOns.length === 0 ? (
            <p className="text-sm text-slate-400">No add-ons yet. Add the first one below.</p>
          ) : (
            <ul className="space-y-2">
              {addOns.map((a) => (
                <AddOnRow
                  key={a.id}
                  addOn={a}
                  appointmentTypeId={appointmentTypeId as string}
                  groupListId={groupListId}
                />
              ))}
            </ul>
          )}
          <AddAddOnForm
            appointmentTypeId={appointmentTypeId as string}
            nextOrder={addOns.length}
            groupListId={groupListId}
          />
        </div>
      )}
    </div>
  )
}
