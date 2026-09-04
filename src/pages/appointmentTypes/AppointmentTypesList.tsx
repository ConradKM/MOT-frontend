import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useAppointmentTypes,
  useChecklistTemplate,
  useCreateAppointmentType,
  useDeleteAppointmentType,
  useUpdateAppointmentType,
} from '../../api/queries'
import type { AppointmentTypeInput } from '../../api/appointmentTypes'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import { Disclosure } from '../../components/Disclosure'
import { useGarageId } from '../../hooks/useGarageId'
import { useToast } from '../../components/Toast'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import type { AppointmentType, AppointmentTypeStatus } from '../../types'

const STATUSES: AppointmentTypeStatus[] = ['ACTIVE', 'HIDDEN', 'DEPRECATED']

const typeStatusClasses: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  HIDDEN: 'bg-slate-100 text-slate-500',
  DEPRECATED: 'bg-amber-100 text-amber-700',
}

interface FormValues {
  name: string
  description: string
  base_price: string
  default_duration_minutes: string
  status: AppointmentTypeStatus
}

const emptyForm: FormValues = {
  name: '',
  description: '',
  base_price: '',
  default_duration_minutes: '',
  status: 'ACTIVE',
}

function toInput(v: FormValues): AppointmentTypeInput {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    base_price: v.base_price.trim() || null,
    default_duration_minutes: v.default_duration_minutes
      ? Number(v.default_duration_minutes)
      : null,
    status: v.status,
  }
}

function TypeFields({
  values,
  onChange,
  errors,
}: {
  values: FormValues
  onChange: (patch: Partial<FormValues>) => void
  errors: Record<string, string>
}) {
  const input =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        <span className="block font-medium text-slate-700">Name</span>
        <input
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={input}
        />
        {errors.name && <span className="mt-1 block text-red-600">{errors.name}</span>}
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block font-medium text-slate-700">Description</span>
        <input
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className={input}
        />
      </label>
      <label className="text-sm">
        <span className="block font-medium text-slate-700">Base price (£)</span>
        <input
          inputMode="decimal"
          placeholder="e.g. 54.85"
          value={values.base_price}
          onChange={(e) => onChange({ base_price: e.target.value })}
          className={input}
        />
        {errors.base_price && (
          <span className="mt-1 block text-red-600">{errors.base_price}</span>
        )}
      </label>
      <label className="text-sm">
        <span className="block font-medium text-slate-700">Default duration (min)</span>
        <input
          type="number"
          min={1}
          value={values.default_duration_minutes}
          onChange={(e) => onChange({ default_duration_minutes: e.target.value })}
          className={input}
        />
        {errors.default_duration_minutes && (
          <span className="mt-1 block text-red-600">{errors.default_duration_minutes}</span>
        )}
      </label>
      <label className="text-sm">
        <span className="block font-medium text-slate-700">Status</span>
        <select
          value={values.status}
          onChange={(e) => onChange({ status: e.target.value as AppointmentTypeStatus })}
          className={input}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function AddAppointmentTypeForm() {
  const create = useCreateAppointmentType()
  const { showToast } = useToast()
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)
    try {
      await create.mutateAsync(toInput(values))
      setValues(emptyForm)
      showToast('Appointment type added.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setFormError('Only the garage owner can add appointment types.')
        return
      }
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    }
  }

  return (
    <form className="max-w-lg space-y-3" onSubmit={handleSubmit}>
      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}
      <TypeFields
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        errors={errors}
      />
      <button
        type="submit"
        disabled={create.isPending || !values.name.trim()}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {create.isPending ? 'Adding…' : 'Add appointment type'}
      </button>
    </form>
  )
}

function EditRow({ type, onDone }: { type: AppointmentType; onDone: () => void }) {
  const update = useUpdateAppointmentType()
  const { showToast } = useToast()
  const [values, setValues] = useState<FormValues>({
    name: type.name,
    description: type.description ?? '',
    base_price: type.base_price ?? '',
    default_duration_minutes: type.default_duration_minutes?.toString() ?? '',
    status: type.status,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const save = async () => {
    setErrors({})
    setFormError(null)
    try {
      await update.mutateAsync({ id: type.id, data: toInput(values) })
      showToast('Appointment type updated.', 'success')
      onDone()
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setFormError('Only the garage owner can edit appointment types.')
        return
      }
      const fields = fieldErrors(err)
      setErrors(fields)
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err))
    }
  }

  return (
    <tr className="border-b border-slate-100 bg-slate-50 last:border-0">
      <td colSpan={4} className="px-4 py-4">
        <div className="space-y-3">
          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
          <TypeFields
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            errors={errors}
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={save}
              disabled={update.isPending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function AppointmentTypeRow({
  type,
  onEdit,
}: {
  type: AppointmentType
  onEdit: () => void
}) {
  const garageId = useGarageId()
  const { data: template, isLoading } = useChecklistTemplate(type.id)
  const remove = useDeleteAppointmentType()
  const { showToast } = useToast()
  const hasTemplate = !!template

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${type.name}"? This can't be undone.`)) return
    try {
      await remove.mutateAsync(type.id)
      showToast('Appointment type deleted.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 409) {
        showToast('This type has appointments booked against it — hide it instead.')
      } else if (isApiError(err) && err.code === 403) {
        showToast('Only the garage owner can delete appointment types.')
      } else {
        showToast(errorMessage(err))
      }
    }
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2">
        <p className="font-medium text-slate-900">{type.name}</p>
        {type.description && <p className="text-xs text-slate-500">{type.description}</p>}
      </td>
      <td className="px-4 py-2 text-slate-600">
        {type.base_price != null ? `£${type.base_price}` : '—'}
        {type.default_duration_minutes != null ? ` · ${type.default_duration_minutes}m` : ''}
      </td>
      <td className="px-4 py-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeStatusClasses[type.status]}`}
        >
          {type.status}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex flex-wrap justify-end gap-3 text-sm font-medium">
          {!isLoading && hasTemplate && (
            <Link
              to={`/${garageId}/appointment-types/${type.id}/checklist`}
              className="text-slate-600 hover:underline"
            >
              View checklist
            </Link>
          )}
          {!isLoading && (
            <Link
              to={`/${garageId}/appointment-types/${type.id}/checklist/build`}
              className="text-slate-900 hover:underline"
            >
              {hasTemplate ? 'Edit checklist' : 'Build checklist'}
            </Link>
          )}
          <button onClick={onEdit} className="text-slate-600 hover:underline">
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={remove.isPending}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

export function AppointmentTypesList() {
  const { data: types, isLoading } = useAppointmentTypes()
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <SettingsLayout>
      <h1 className="text-2xl font-semibold text-slate-900">Appointment Types</h1>
      <p className="mt-1 text-sm text-slate-500">
        The services your business offers. Each type can have one checklist that staff work
        through, and appears in the public booking form while it's <strong>ACTIVE</strong>.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
        ) : types && types.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Price / duration</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {types.map((type) =>
                editingId === type.id ? (
                  <EditRow key={type.id} type={type} onDone={() => setEditingId(null)} />
                ) : (
                  <AppointmentTypeRow
                    key={type.id}
                    type={type}
                    onEdit={() => setEditingId(type.id)}
                  />
                ),
              )}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-3 text-sm text-slate-500">
            No appointment types yet — add one below so customers have something to book.
          </p>
        )}
      </div>

      <div className="mt-6">
        <Disclosure title="Add appointment type">
          <AddAppointmentTypeForm />
        </Disclosure>
      </div>
    </SettingsLayout>
  )
}
