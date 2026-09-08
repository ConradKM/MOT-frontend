import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useAppointmentType,
  useChecklistTemplate,
  useCreateChecklistTemplate,
  useCreateChecklistTemplateItem,
  useDeleteChecklistTemplateItem,
  useUpdateChecklistTemplateItem,
} from '../../api/queries'
import { useGarageId } from '../../hooks/useGarageId'
import { useToast } from '../../components/Toast'
import { errorMessage, isApiError } from '../../lib/errors'
import { resultOptionLabel } from '../../lib/checklist'
import {
  AUTOMOTIVE_RESULT_OPTIONS,
  GENERIC_RESULT_OPTIONS,
  type ChecklistItemMediaType,
  type ChecklistItemStatus,
  type ChecklistTemplateItem,
} from '../../types'

const MEDIA_TYPES: ChecklistItemMediaType[] = ['NONE', 'PHOTO', 'VIDEO', 'EITHER']
const mediaTypeLabels: Record<ChecklistItemMediaType, string> = {
  NONE: 'No media',
  PHOTO: 'Photo',
  VIDEO: 'Video',
  EITHER: 'Photo or video',
}

const inputClass =
  'rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none'

function ItemRow({
  item,
  appointmentTypeId,
  isFirst,
  isLast,
  onMove,
}: {
  item: ChecklistTemplateItem
  appointmentTypeId: string
  isFirst: boolean
  isLast: boolean
  onMove: (item: ChecklistTemplateItem, direction: -1 | 1) => void
}) {
  const updateItem = useUpdateChecklistTemplateItem(appointmentTypeId)
  const deleteItem = useDeleteChecklistTemplateItem(appointmentTypeId)
  const { showToast } = useToast()

  const [label, setLabel] = useState(item.label)
  const [description, setDescription] = useState(item.description ?? '')
  const [isCompulsory, setIsCompulsory] = useState(item.is_compulsory)
  const [visibleToCustomer, setVisibleToCustomer] = useState(item.visible_to_customer)
  const [mediaType, setMediaType] = useState(item.media_type)
  const [mediaStatuses, setMediaStatuses] = useState(item.media_required_for_statuses)
  const [resultOptions, setResultOptions] = useState(item.result_options)
  const [newOption, setNewOption] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const dirty =
    label !== item.label ||
    description !== (item.description ?? '') ||
    isCompulsory !== item.is_compulsory ||
    visibleToCustomer !== item.visible_to_customer ||
    mediaType !== item.media_type ||
    mediaStatuses.join(',') !== item.media_required_for_statuses.join(',') ||
    resultOptions.join(',') !== item.result_options.join(',')

  const toggleStatus = (status: ChecklistItemStatus) => {
    setMediaStatuses((s) => (s.includes(status) ? s.filter((x) => x !== status) : [...s, status]))
  }

  const applyResultOptions = (options: ChecklistItemStatus[]) => {
    setResultOptions(options)
    // A media requirement pointing at a result this item no longer offers
    // isn't valid - keep only what's still selectable.
    setMediaStatuses((s) => s.filter((status) => options.includes(status)))
  }

  const addCustomOption = () => {
    const value = newOption.trim().toUpperCase().replace(/\s+/g, '_')
    if (!value || resultOptions.includes(value)) return
    applyResultOptions([...resultOptions, value])
    setNewOption('')
  }

  const removeOption = (status: ChecklistItemStatus) => {
    applyResultOptions(resultOptions.filter((s) => s !== status))
  }

  const handleSave = async () => {
    try {
      await updateItem.mutateAsync({
        itemId: item.id,
        data: {
          label,
          description: description.trim() || null,
          is_compulsory: isCompulsory,
          visible_to_customer: visibleToCustomer,
          media_type: mediaType,
          media_required_for_statuses: mediaStatuses,
          result_options: resultOptions,
        },
      })
      showToast('Step saved.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const handleDelete = async () => {
    try {
      await deleteItem.mutateAsync(item.id)
      showToast('Step removed.', 'success')
    } catch (err) {
      setConfirmingDelete(false)
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1.5">
          <button
            type="button"
            onClick={() => onMove(item, -1)}
            disabled={isFirst}
            className="text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Move up"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMove(item, 1)}
            disabled={isLast}
            className="text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Move down"
          >
            ▼
          </button>
        </div>

        <div className="flex-1 space-y-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`w-full ${inputClass}`}
            placeholder="Step description"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`w-full ${inputClass}`}
            placeholder="Extra instruction (optional)"
          />

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isCompulsory}
                onChange={(e) => setIsCompulsory(e.target.checked)}
              />
              Compulsory
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={visibleToCustomer}
                onChange={(e) => setVisibleToCustomer(e.target.checked)}
              />
              Show to customer
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              Media
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as ChecklistItemMediaType)}
                className={inputClass}
              >
                {MEDIA_TYPES.map((mt) => (
                  <option key={mt} value={mt}>
                    {mediaTypeLabels[mt]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Results this step can be logged as:</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {resultOptions.map((status) => (
                <span
                  key={status}
                  className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                >
                  {resultOptionLabel(status)}
                  <button
                    type="button"
                    onClick={() => removeOption(status)}
                    aria-label={`Remove ${resultOptionLabel(status)}`}
                    className="text-slate-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyResultOptions(GENERIC_RESULT_OPTIONS)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Simple (Done / N/A)
              </button>
              <button
                type="button"
                onClick={() => applyResultOptions(AUTOMOTIVE_RESULT_OPTIONS)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                MOT-style grading
              </button>
              <input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomOption()
                  }
                }}
                placeholder="Add custom result…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addCustomOption}
                disabled={!newOption.trim()}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {mediaType !== 'NONE' && (
            <div>
              <p className="text-xs font-medium text-slate-500">
                Require media when the result is:
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {resultOptions.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
                  >
                    <input
                      type="checkbox"
                      checked={mediaStatuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                    />
                    {resultOptionLabel(status)}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || updateItem.isPending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {updateItem.isPending ? 'Saving…' : 'Save'}
            </button>
            {confirmingDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">Remove this step?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteItem.isPending}
                  className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteItem.isPending ? 'Removing…' : 'Yes, remove'}
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
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddItemForm({ appointmentTypeId, nextOrder }: { appointmentTypeId: string; nextOrder: number }) {
  const createItem = useCreateChecklistTemplateItem(appointmentTypeId)
  const { showToast } = useToast()
  const [label, setLabel] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    try {
      await createItem.mutateAsync({ label, order: nextOrder })
      setLabel('')
      showToast('Step added.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="New step description"
        className={`flex-1 ${inputClass}`}
      />
      <button
        type="submit"
        disabled={createItem.isPending || !label.trim()}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        Add step
      </button>
    </form>
  )
}

export function ChecklistTemplateBuilder() {
  const garageId = useGarageId()
  const { appointmentTypeId } = useParams<{ appointmentTypeId: string }>()
  const { data: appointmentType } = useAppointmentType(appointmentTypeId)
  const {
    data: template,
    isLoading,
    isError,
    error,
  } = useChecklistTemplate(appointmentTypeId)
  const createTemplate = useCreateChecklistTemplate(appointmentTypeId as string)
  const updateItem = useUpdateChecklistTemplateItem(appointmentTypeId as string)
  const { showToast } = useToast()

  const noTemplateYet = isError && isApiError(error) && error.code === 404

  const handleMove = async (item: ChecklistTemplateItem, direction: -1 | 1) => {
    if (!template) return
    const index = template.items.findIndex((i) => i.id === item.id)
    const swapWith = template.items[index + direction]
    if (!swapWith) return
    try {
      await Promise.all([
        updateItem.mutateAsync({ itemId: item.id, data: { order: swapWith.order } }),
        updateItem.mutateAsync({ itemId: swapWith.id, data: { order: item.order } }),
      ])
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const handleCreateTemplate = async () => {
    try {
      await createTemplate.mutateAsync()
      showToast('Checklist created — add your first step below.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        to={`/${garageId}/settings/appointment-types`}
        className="text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← Back to Appointment Types
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">
        Checklist for {appointmentType?.name ?? '…'}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Steps staff work through during this appointment type. Only business owners can
        make changes here.
      </p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

      {noTemplateYet && (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm text-slate-600">No checklist has been built for this type yet.</p>
          <button
            type="button"
            onClick={handleCreateTemplate}
            disabled={createTemplate.isPending}
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createTemplate.isPending ? 'Creating…' : 'Create checklist'}
          </button>
        </div>
      )}

      {template && (
        <div className="mt-6 space-y-3">
          {template.items.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              appointmentTypeId={appointmentTypeId as string}
              isFirst={i === 0}
              isLast={i === template.items.length - 1}
              onMove={handleMove}
            />
          ))}
          {template.items.length === 0 && (
            <p className="text-sm text-slate-400">No steps yet — add the first one below.</p>
          )}

          <div className="pt-2">
            <AddItemForm
              appointmentTypeId={appointmentTypeId as string}
              nextOrder={template.items.length}
            />
          </div>
        </div>
      )}
    </div>
  )
}
