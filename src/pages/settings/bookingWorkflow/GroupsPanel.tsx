import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
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
import { ImageUploadField } from '../../../components/settings/ImageUploadField'
import {
  EXPAND_PANEL_CLASS,
  ExpandableRow,
  ExpandToggle,
  SettingsTable,
  Td,
  Th,
  closeOnEscape,
  useExpandFocus,
} from '../../../components/settings/ExpandableRow'
import { SectionHeading } from '../../../components/settings/SettingsUI'

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none'

const DISPLAY_MODE_LABEL: Record<DisplayMode, string> = {
  LIST: 'List',
  GRID: 'Grid of pictures',
}

const SMALL_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:min-h-8'

/**
 * Grouping is optional navigation. A business with a short menu groups
 * nothing and its services are offered as one flat list; grouping earns its
 * place once the menu is long enough that a flat list stops being navigable.
 *
 * Each group is its own table under a heading that carries the group's
 * controls; ungrouped services get a table of their own after the groups.
 * With no groups at all there is just one table of every service.
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
  // One editor open at a time across the whole tab - a group or a service.
  const [editing, setEditing] = useState<string | null>(null)

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
  const toggle = (key: string) => setEditing((current) => (current === key ? null : key))
  const close = () => setEditing(null)

  return (
    <div className="space-y-8">
      {groups.length === 0 ? (
        <section aria-labelledby="services-heading">
          <SectionHeading
            id="services-heading"
            title="Services"
            info={
              <>
                Group your services so customers can find what they want. Each group can show as
                a list - name, price and duration side by side - or as a grid of pictures, for
                when the customer is choosing how something will look.
              </>
            }
          />
          <p className="mt-1 text-sm text-slate-600">
            No groups yet. Your services are offered as one list, which is usually right until
            the list gets long.
          </p>
          <div className="mt-3">
            <ServicesTable
              services={services}
              groups={groups}
              label="Services"
              editing={editing}
              onToggle={toggle}
              onClose={close}
            />
          </div>
        </section>
      ) : (
        <>
          {groups.map((group, i) => (
            <GroupSection
              key={group.id}
              group={group}
              services={services.filter((s) => s.group_id === group.id)}
              allGroups={groups}
              isFirst={i === 0}
              isLast={i === groups.length - 1}
              onMove={(direction) => move(i, direction)}
              editing={editing}
              onToggle={toggle}
              onClose={close}
            />
          ))}

          <section aria-labelledby="ungrouped-heading">
            <SectionHeading
              as="h3"
              id="ungrouped-heading"
              title="Ungrouped services"
              info="Offered on their own, after any groups."
            />
            <div className="mt-3">
              {ungrouped.length === 0 ? (
                <p className="text-sm text-slate-600">Every service belongs to a group.</p>
              ) : (
                <ServicesTable
                  services={ungrouped}
                  groups={groups}
                  label="Ungrouped services"
                  editing={editing}
                  onToggle={toggle}
                  onClose={close}
                />
              )}
            </div>
          </section>
        </>
      )}

      <AddGroup
        nextOrder={groups.length}
        expanded={editing === 'add-group'}
        onToggle={() => toggle('add-group')}
        onClose={close}
      />
    </div>
  )
}

function GroupSection({
  group,
  services,
  allGroups,
  isFirst,
  isLast,
  onMove,
  editing,
  onToggle,
  onClose,
}: {
  group: AppointmentTypeGroup
  services: AppointmentType[]
  /** Every group, so a service can be moved straight from this one to
   * another rather than via a round trip through "ungrouped". */
  allGroups: AppointmentTypeGroup[]
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  editing: string | null
  onToggle: (key: string) => void
  onClose: () => void
}) {
  const key = `group:${group.id}`
  const expanded = editing === key
  const headingId = `group-heading-${group.id}`
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useExpandFocus(expanded, panelRef, toggleRef)

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 id={headingId} className="text-base font-semibold text-slate-900">
            {group.name}
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {group.display_mode ? DISPLAY_MODE_LABEL[group.display_mode] : 'Business default'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Move up"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            className={`${SMALL_BUTTON} w-11 sm:w-8`}
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={isLast}
            onClick={() => onMove(1)}
            className={`${SMALL_BUTTON} w-11 sm:w-8`}
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <ExpandToggle
            ref={toggleRef}
            aria-expanded={expanded}
            aria-controls={expanded ? `${headingId}-editor` : undefined}
            onClick={() => onToggle(key)}
            label="Edit group"
          />
        </div>
      </div>

      {expanded && (
        <div
          ref={panelRef}
          id={`${headingId}-editor`}
          role="region"
          aria-label={`Edit group ${group.name}`}
          onKeyDown={closeOnEscape(onClose)}
          className={EXPAND_PANEL_CLASS}
        >
          <GroupEditor group={group} onDone={onClose} />
        </div>
      )}

      {services.length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 shadow-card">
          No services in this group — it stays hidden from customers until one is added.
        </p>
      ) : (
        <ServicesTable
          services={services}
          groups={allGroups}
          label={`${group.name} services`}
          editing={editing}
          onToggle={onToggle}
          onClose={onClose}
        />
      )}
    </section>
  )
}

function GroupEditor({ group, onDone }: { group: AppointmentTypeGroup; onDone: () => void }) {
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
      onDone()
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
    <div className="max-w-2xl space-y-3">
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
          Description <span className="font-normal text-slate-600">(optional)</span>
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || update.isPending}
            className="min-h-11 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 sm:min-h-0"
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

        {confirmingDelete ? (
          <span className="flex items-center gap-3 text-sm">
            <span className="text-slate-700">Remove this group?</span>
            <button
              type="button"
              onClick={doDelete}
              className="min-h-11 font-medium text-red-700 hover:text-red-800 sm:min-h-0"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="min-h-11 text-slate-700 sm:min-h-0"
            >
              Keep it
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="min-h-11 text-sm font-medium text-slate-700 hover:text-red-700 sm:min-h-0"
          >
            Remove group
          </button>
        )}
      </div>
    </div>
  )
}

function formatPrice(service: AppointmentType): string {
  return service.base_price != null ? `£${service.base_price}` : '—'
}

function formatDuration(service: AppointmentType): string {
  return service.default_duration_minutes != null ? `${service.default_duration_minutes} min` : '—'
}

function ServicesTable({
  services,
  groups,
  label,
  editing,
  onToggle,
  onClose,
}: {
  services: AppointmentType[]
  groups: AppointmentTypeGroup[]
  label: string
  editing: string | null
  onToggle: (key: string) => void
  onClose: () => void
}) {
  if (services.length === 0) {
    return (
      <p className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 shadow-card">
        No services yet. Add them on the Appointment Types page.
      </p>
    )
  }
  return (
    <SettingsTable
      label={label}
      minWidth="min-w-[36rem]"
      columns={[undefined, 'w-24', 'w-24', 'w-28', 'w-24']}
      head={
        <tr>
          <Th>Name</Th>
          <Th>Price</Th>
          <Th>Duration</Th>
          <Th>Status</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      }
    >
      {services.map((service) => {
        const key = `service:${service.id}`
        return (
          <ExpandableRow
            key={service.id}
            colSpan={5}
            expanded={editing === key}
            onClose={onClose}
            label={`Edit ${service.name}`}
            summary={(toggle) => (
              <>
                <Td>
                  <span className="font-medium text-slate-900">{service.name}</span>
                </Td>
                <Td className="text-slate-700">{formatPrice(service)}</Td>
                <Td className="text-slate-700">{formatDuration(service)}</Td>
                <Td className="text-xs font-medium text-slate-700">{service.status}</Td>
                <Td className="text-right">
                  <ExpandToggle {...toggle} onClick={() => onToggle(key)} />
                </Td>
              </>
            )}
          >
            <ServiceEditor service={service} groups={groups} onDone={onClose} />
          </ExpandableRow>
        )
      })}
    </SettingsTable>
  )
}

/** One service's group and picture. Editing a service's name, price or
 * duration stays on the Appointment Types page - this is only the parts that
 * affect how it is *presented*. */
function ServiceEditor({
  service,
  groups,
  onDone,
}: {
  service: AppointmentType
  /** Every group this service could be in. Moving a service between two
   * groups is the common operation, and making that a remove-then-reassign
   * round trip would be worse than the one dropdown. */
  groups: AppointmentTypeGroup[]
  onDone: () => void
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

  return (
    <div className="max-w-2xl space-y-3">
      {groups.length > 0 && (
        <label className="block max-w-xs">
          <span className="block text-sm font-medium text-slate-700">Group</span>
          <select
            aria-label={`Group for ${service.name}`}
            className={`mt-1 ${inputClass}`}
            value={service.group_id ?? ''}
            onChange={(e) => assign(e.target.value)}
            disabled={update.isPending}
          >
            <option value="">Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <ImageUploadField
        label="Picture (shown in grid mode)"
        imageUrl={service.image_url}
        onUpload={(file) => upload.mutateAsync(file)}
        onRemove={() => removeImage.mutateAsync()}
      />
      <button
        type="button"
        onClick={onDone}
        className="min-h-11 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-h-0"
      >
        Done
      </button>
    </div>
  )
}

function AddGroup({
  nextOrder,
  expanded,
  onToggle,
  onClose,
}: {
  nextOrder: number
  expanded: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const create = useCreateAppointmentTypeGroup()
  const { showToast } = useToast()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLFormElement>(null)
  useExpandFocus(expanded, panelRef, toggleRef)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await create.mutateAsync({ name: name.trim(), order: nextOrder })
      setName('')
      showToast('Group added.', 'success')
      onClose()
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-200 pt-6">
      <button
        ref={toggleRef}
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={expanded ? 'add-group-form' : undefined}
        className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
      >
        {expanded ? 'Close' : 'Add group'}
      </button>
      {expanded && (
        <form
          ref={panelRef}
          id="add-group-form"
          aria-label="Add a group"
          onSubmit={submit}
          onKeyDown={closeOnEscape(onClose)}
          className={`flex flex-wrap items-end gap-2 ${EXPAND_PANEL_CLASS}`}
        >
          <label className="min-w-48 flex-1">
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
            className="min-h-11 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 sm:min-h-0"
          >
            Add
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-h-0"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}
