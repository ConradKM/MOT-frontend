import { useState, type FormEvent } from 'react'
import {
  useAppointmentStatuses,
  useCreateAppointmentStatus,
  useDeleteAppointmentStatus,
  useUpdateAppointmentStatus,
} from '../../api/queries'
import { Disclosure } from '../../components/Disclosure'
import {
  ExpandableRow,
  ExpandToggle,
  SettingsTable,
  Td,
  Th,
} from '../../components/settings/ExpandableRow'
import { SettingsPageHeader } from '../../components/settings/SettingsUI'
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

function EditStatusPanel({
  status,
  onDone,
}: {
  status: GarageAppointmentStatus
  onDone: () => void
}) {
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
      setError(isApiError(err) && err.code === 403 ? 'Only the business owner can edit statuses.' : errorMessage(err))
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
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
          className="min-h-11 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:min-h-0"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-h-0"
        >
          Cancel
        </button>
      </div>
    </div>
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
      if (isApiError(err) && err.code === 403) setError('Only the business owner can add statuses.')
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
        showToast('Only the business owner can delete statuses.')
      else showToast(errorMessage(err))
    }
  }

  return (
    <>
      <SettingsPageHeader
        title="Appointment Statuses"
        info="The labels and colours used for appointment statuses across the app. The seven built-in ones can be renamed and recoloured; you can add your own too."
      />

      <div className="mt-6">
        {isLoading ? (
          <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-600 shadow-card">
            Loading…
          </p>
        ) : statuses && statuses.length > 0 ? (
          <SettingsTable
            label="Appointment statuses"
            minWidth="min-w-[36rem]"
            columns={[undefined, 'w-1/4', 'w-1/5', 'w-44']}
            head={
              <tr>
                <Th>Label</Th>
                <Th>Key</Th>
                <Th>Colour</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            }
          >
            {statuses.map((s) => (
              <ExpandableRow
                key={s.id}
                colSpan={4}
                expanded={editingId === s.id}
                onClose={() => setEditingId(null)}
                label={`Edit ${s.label}`}
                summary={(toggle) => (
                  <>
                    <Td>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(statuses, s.key)}`}
                      >
                        {s.label}
                      </span>
                    </Td>
                    <Td className="font-mono text-xs text-slate-600">{s.key}</Td>
                    <Td>
                      <Swatch color={s.color} />
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-x-1">
                        <ExpandToggle
                          {...toggle}
                          onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                        />
                        {!s.is_system && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-red-700 hover:underline sm:min-h-0 sm:py-1"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </Td>
                  </>
                )}
              >
                <EditStatusPanel status={s} onDone={() => setEditingId(null)} />
              </ExpandableRow>
            ))}
          </SettingsTable>
        ) : (
          <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-600 shadow-card">
            Using the built-in status set. Add one below to customise.
          </p>
        )}
      </div>

      <div className="mt-6">
        <Disclosure title="Add status">
          <AddStatusForm />
        </Disclosure>
      </div>
    </>
  )
}
