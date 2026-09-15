import { useState } from 'react'
import type { AppointmentType, AppointmentTypeGroup, DisplayMode } from '../../../types'
import {
  useCreateAppointmentTypeGroup,
  useDeleteAppointmentTypeGroup,
  useDeleteImage,
  useReorderAppointmentTypeGroups,
  useUpdateAppointmentType,
  useUpdateAppointmentTypeGroup,
  useUploadImage,
} from '../../../api/queries'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../../components/Toast'
import { errorMessage } from '../../../lib/errors'
import { Disclosure } from '../../../components/Disclosure'
import { ImageUploadField } from '../../../components/settings/ImageUploadField'

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none'

/**
 * Grouping is optional navigation. A business with a short menu groups
 * nothing and its services are offered as one flat list; grouping earns its
 * place once the menu is long enough that a flat list stops being navigable.
 */
export function GroupsPanel({
  groups,
  services,
  loading,
}: {
  groups: AppointmentTypeGroup[]
  services: AppointmentType[]
  loading: boolean
}) {
  const reorder = useReorderAppointmentTypeGroups()
  const { showToast } = useToast()

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...groups]
    const target = next[index + direction]
    if (!target) return
    next[index + direction] = next[index]
    next[index] = target
    try {
      await reorder.mutateAsync(next.map((g) => g.id))
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const ungrouped = services.filter((s) => s.group_id === null)

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Group your services so customers can find what they want. Each group can show as a list —
        name, price and duration side by side — or as a grid of pictures, for when the customer is
        choosing how something will look.
      </p>

      {groups.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
          No groups yet. Your services are offered as one list, which is usually right until the
          list gets long.
        </p>
      )}

      <ul className="space-y-3">
        {groups.map((group, i) => (
          <GroupRow
            key={group.id}
            group={group}
            services={services.filter((s) => s.group_id === group.id)}
            allServices={services}
            isFirst={i === 0}
            isLast={i === groups.length - 1}
            onMove={(direction) => move(i, direction)}
          />
        ))}
      </ul>

      <Disclosure title="Add a group">
        <AddGroupForm nextOrder={groups.length} />
      </Disclosure>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Ungrouped services</h2>
        <p className="mt-1 text-sm text-slate-500">
          Offered on their own, after any groups.
        </p>
        {ungrouped.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Every service belongs to a group.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {ungrouped.map((service) => (
              <ServiceRow key={service.id} service={service} groups={groups} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function GroupRow({
  group,
  services,
  allServices,
  isFirst,
  isLast,
  onMove,
}: {
  group: AppointmentTypeGroup
  services: AppointmentType[]
  allServices: AppointmentType[]
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
}) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [displayMode, setDisplayMode] = useState<DisplayMode | ''>(group.display_mode ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const update = useUpdateAppointmentTypeGroup()
  const remove = useDeleteAppointmentTypeGroup()
  const { showToast } = useToast()
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['appointmentTypeGroups'] })
  }
  const upload = useUploadImage<AppointmentTypeGroup>(
    `/api/appointment-type-groups/${group.id}/image`,
    invalidate,
  )
  const removeImage = useDeleteImage<AppointmentTypeGroup>(
    `/api/appointment-type-groups/${group.id}/image`,
    invalidate,
  )

  const dirty =
    name !== group.name ||
    description !== (group.description ?? '') ||
    displayMode !== (group.display_mode ?? '')

  const save = async () => {
    try {
      await update.mutateAsync({
        id: group.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          // "" is the UI's way of saying "no preference" - sent as null so the
          // group keeps inheriting the business default.
          display_mode: displayMode === '' ? null : displayMode,
        },
      })
      showToast('Group saved.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const doDelete = async () => {
    try {
      await remove.mutateAsync(group.id)
      showToast('Group removed. Its services are still offered, just ungrouped.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Name</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700">Show as</span>
              <select
                className={`mt-1 ${inputClass}`}
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as DisplayMode | '')}
              >
                <option value="">Same as the rest of the business</option>
                <option value="LIST">List — name, price, duration</option>
                <option value="GRID">Grid — pictures</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              className={`mt-1 ${inputClass}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <ImageUploadField
            label="Group picture (optional)"
            imageUrl={group.image_url}
            onUpload={(file) => upload.mutateAsync(file)}
            onRemove={() => removeImage.mutateAsync()}
          />
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            aria-label="Move up"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            className="rounded border border-slate-200 px-2 text-slate-500 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={isLast}
            onClick={() => onMove(1)}
            className="rounded border border-slate-200 px-2 text-slate-500 disabled:opacity-30"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-xs font-medium text-slate-500">
          {services.length === 0
            ? 'No services in this group — it stays hidden from customers until one is added.'
            : `${services.length} service${services.length === 1 ? '' : 's'}`}
        </p>
        {services.length > 0 && (
          <ul className="mt-2 space-y-2">
            {services.map((service) => (
              <ServiceRow key={service.id} service={service} groups={[]} allServices={allServices} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || update.isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>

        {confirmingDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-slate-600">Remove this group?</span>
            <button
              type="button"
              onClick={doDelete}
              className="font-medium text-red-600 hover:text-red-700"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-slate-500"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs font-medium text-slate-500 hover:text-red-600"
          >
            Remove group
          </button>
        )}
      </div>
    </li>
  )
}

/** One service, with the group it belongs to and its picture. Editing a
 * service's name or price stays on the Appointment Types page - this is only
 * the parts that affect how it is *presented*. */
function ServiceRow({
  service,
  groups,
  allServices,
}: {
  service: AppointmentType
  groups: AppointmentTypeGroup[]
  allServices?: AppointmentType[]
}) {
  const update = useUpdateAppointmentType()
  const { showToast } = useToast()
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['appointmentTypes'] })
  }
  const upload = useUploadImage<AppointmentType>(
    `/api/appointment-types/${service.id}/image`,
    invalidate,
  )
  const removeImage = useDeleteImage<AppointmentType>(
    `/api/appointment-types/${service.id}/image`,
    invalidate,
  )

  const assign = async (groupId: string) => {
    try {
      await update.mutateAsync({ id: service.id, data: { group_id: groupId || null } })
      showToast('Service moved.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const selectable = groups.length > 0 ? groups : []

  return (
    <li className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-900">{service.name}</span>
        {selectable.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Group
            <select
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={service.group_id ?? ''}
              onChange={(e) => assign(e.target.value)}
              disabled={update.isPending}
            >
              <option value="">Ungrouped</option>
              {selectable.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {selectable.length === 0 && allServices && (
          <button
            type="button"
            onClick={() => assign('')}
            disabled={update.isPending}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Remove from group
          </button>
        )}
      </div>
      <div className="mt-2">
        <ImageUploadField
          label="Picture (shown in grid mode)"
          imageUrl={service.image_url}
          onUpload={(file) => upload.mutateAsync(file)}
          onRemove={() => removeImage.mutateAsync()}
        />
      </div>
    </li>
  )
}

function AddGroupForm({ nextOrder }: { nextOrder: number }) {
  const [name, setName] = useState('')
  const create = useCreateAppointmentTypeGroup()
  const { showToast } = useToast()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await create.mutateAsync({ name: name.trim(), order: nextOrder })
      setName('')
      showToast('Group added.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex-1">
        <span className="block text-sm font-medium text-slate-700">Group name</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Colour, Repairs, Servicing"
        />
      </label>
      <button
        type="submit"
        disabled={!name.trim() || create.isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}
