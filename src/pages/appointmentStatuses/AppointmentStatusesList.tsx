import { useState, type FormEvent } from 'react'
import {
  useAppointmentStatuses,
  useCreateAppointmentStatus,
  useDeleteAppointmentStatus,
  useUpdateAppointmentStatus,
} from '../../api/queries'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import { Disclosure } from '../../components/Disclosure'
import { useToast } from '../../components/Toast'
import { errorMessage, isApiError } from '../../lib/errors'
import { STATUS_COLORS, statusBadgeClass } from '../../lib/appointmentStatuses'
import type { GarageAppointmentStatus } from '../../types'

function Swatch({ color }: { color: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
        [{ color, key: '', label: '' } as GarageAppointmentStatus],
        '',
      )}`}
    >
      {color}
    </span>
  )
}

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'

function ColorSelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {STATUS_COLORS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

function EditRow({ status, onDone }: { status: GarageAppointmentStatus; onDone: () => void }) {
  const update = useUpdateAppointmentStatus()
  const { showToast } = useToast()
  const [label, setLabel] = useState(status.label)
  const [color, setColor] = useState(status.color)
  const [sortOrder, setSortOrder] = useState(String(status.sort_order))
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    try {
      await update.mutateAsync({
        id: status.id,
        data: { label, color, sort_order: Number(sortOrder) || 0 },
      })
      showToast('Status updated.', 'success')
      onDone()
    } catch (err) {
      setError(isApiError(err) && err.code === 403 ? 'Only the garage owner can edit statuses.' : errorMessage(err))
    }
  }

  return (
    <tr className="border-b border-slate-100 bg-slate-50 last:border-0">
      <td colSpan={4} className="px-4 py-4">
        <div className="space-y-3">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Label</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Colour</span>
              <ColorSelect value={color} onChange={setColor} />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700">Sort order</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
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

function AddStatusForm() {
  const create = useCreateAppointmentStatus()
  const { showToast } = useToast()
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('slate')
  const [sortOrder, setSortOrder] = useState('80')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await create.mutateAsync({ label, color, sort_order: Number(sortOrder) || 0 })
      setLabel('')
      showToast('Status added.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 403) setError('Only the garage owner can add statuses.')
      else if (isApiError(err) && err.code === 409) setError('A status with that name already exists.')
      else setError(errorMessage(err))
    }
  }

  return (
    <form className="max-w-lg space-y-3" onSubmit={handleSubmit}>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Colour</span>
          <ColorSelect value={color} onChange={setColor} />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">Sort order</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={create.isPending || !label.trim()}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {create.isPending ? 'Adding…' : 'Add status'}
      </button>
    </form>
  )
}

export function AppointmentStatusesList() {
  const { data: statuses, isLoading } = useAppointmentStatuses()
  const remove = useDeleteAppointmentStatus()
  const { showToast } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleDelete = async (s: GarageAppointmentStatus) => {
    if (!window.confirm(`Delete "${s.label}"?`)) return
    try {
      await remove.mutateAsync(s.id)
      showToast('Status deleted.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 409)
        showToast('This status is in use by one or more appointments.')
      else if (isApiError(err) && err.code === 403)
        showToast('Only the garage owner can delete statuses.')
      else showToast(errorMessage(err))
    }
  }

  return (
    <SettingsLayout>
      <h1 className="text-2xl font-semibold text-slate-900">Appointment Statuses</h1>
      <p className="mt-1 text-sm text-slate-500">
        The labels and colours used for appointment statuses across the app. The seven built-in
        ones can be renamed and recoloured; you can add your own too.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
        ) : statuses && statuses.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Label</th>
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 font-medium">Colour</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) =>
                editingId === s.id ? (
                  <EditRow key={s.id} status={s} onDone={() => setEditingId(null)} />
                ) : (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(statuses, s.key)}`}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{s.key}</td>
                    <td className="px-4 py-2">
                      <Swatch color={s.color} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-3 text-sm font-medium">
                        <button
                          onClick={() => setEditingId(s.id)}
                          className="text-slate-600 hover:underline"
                        >
                          Edit
                        </button>
                        {!s.is_system && (
                          <button
                            onClick={() => handleDelete(s)}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-3 text-sm text-slate-500">
            Using the built-in status set. Add one below to customise.
          </p>
        )}
      </div>

      <div className="mt-6">
        <Disclosure title="Add status">
          <AddStatusForm />
        </Disclosure>
      </div>
    </SettingsLayout>
  )
}
