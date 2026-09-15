import { useState } from 'react'
import type { AppointmentType } from '../../../types'
import type {
  BookingFieldType,
  BookingFlowField,
  BookingFlowSection,
  FieldBinding,
} from '../../../api/bookingFlow'
import {
  useCreateBookingFlowField,
  useCreateBookingFlowSection,
  useDeleteBookingFlowField,
  useDeleteBookingFlowSection,
  useReorderBookingFlowFields,
  useReorderBookingFlowSections,
  useUpdateBookingFlowField,
  useUpdateBookingFlowSection,
} from '../../../api/queries'
import { useToast } from '../../../components/Toast'
import { errorMessage } from '../../../lib/errors'
import { Disclosure } from '../../../components/Disclosure'
import { PresetPicker } from '../BookingWorkflowSettings'

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none'

const FIELD_TYPES: { value: BookingFieldType; label: string }[] = [
  { value: 'TEXT', label: 'Short text' },
  { value: 'TEXTAREA', label: 'Long text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'SELECT', label: 'Choose one' },
  { value: 'MULTI_SELECT', label: 'Choose several' },
  { value: 'CHECKBOX', label: 'Yes / no' },
  { value: 'DATE', label: 'Date (calendar)' },
  { value: 'TIME', label: 'Time' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone number' },
]

const OPTION_TYPES: BookingFieldType[] = ['SELECT', 'MULTI_SELECT']

/** Bindings are described by what they do for the business, not by the table
 * they happen to write to. A business that doesn't track anything simply
 * never picks one. */
const BINDINGS: { value: FieldBinding; label: string; numeric?: boolean }[] = [
  { value: 'ITEM_REFERENCE', label: "The item's reference (registration, serial, frame number)" },
  { value: 'ITEM_MAKE', label: "The item's make" },
  { value: 'ITEM_MODEL', label: "The item's model" },
  { value: 'ITEM_YEAR', label: "The item's year", numeric: true },
  { value: 'ITEM_USAGE', label: "The item's usage (mileage, hours run)", numeric: true },
]

export function WorkflowPanel({
  sections,
  services,
  loading,
}: {
  sections: BookingFlowSection[]
  services: AppointmentType[]
  loading: boolean
}) {
  // Which workflow is being edited: the business default, or one service's
  // override. Kept as a single selector rather than two lists, because an
  // override *replaces* the default and showing both at once would imply
  // otherwise.
  const [scope, setScope] = useState<string>('')

  const inScope = sections.filter((s) => (s.appointment_type_id ?? '') === scope)
  const reorder = useReorderBookingFlowSections()
  const { showToast } = useToast()

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...inScope]
    const target = next[index + direction]
    if (!target) return
    next[index + direction] = next[index]
    next[index] = target
    try {
      await reorder.mutateAsync(next.map((s) => s.id))
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const defaultCount = sections.filter((s) => s.appointment_type_id === null).length

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          Every booking asks for a name, email and mobile number — we need those to set up the
          customer's account and send their confirmation, so they're always there. Everything else
          is up to you.
        </p>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-slate-700">Editing</span>
        <select
          className={`mt-1 ${inputClass}`}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="">Every booking (your default questions)</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              Only when booking: {s.name}
            </option>
          ))}
        </select>
      </label>

      {scope !== '' && inScope.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
          This service uses your default questions. Add a section here and it will use these
          instead — <strong>not</strong> as well, so include anything from the default you still
          want to ask.
        </p>
      )}

      {scope === '' && defaultCount === 0 && <PresetPicker />}

      <ul className="space-y-4">
        {inScope.map((section, i) => (
          <SectionRow
            key={section.id}
            section={section}
            isFirst={i === 0}
            isLast={i === inScope.length - 1}
            onMove={(direction) => move(i, direction)}
          />
        ))}
      </ul>

      <Disclosure title="Add a section">
        <AddSectionForm
          nextOrder={inScope.length}
          appointmentTypeId={scope === '' ? null : scope}
        />
      </Disclosure>
    </div>
  )
}

function SectionRow({
  section,
  isFirst,
  isLast,
  onMove,
}: {
  section: BookingFlowSection
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
}) {
  const [title, setTitle] = useState(section.title)
  const [description, setDescription] = useState(section.description ?? '')
  const [isActive, setIsActive] = useState(section.is_active)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const update = useUpdateBookingFlowSection()
  const remove = useDeleteBookingFlowSection()
  const reorderFields = useReorderBookingFlowFields()
  const { showToast } = useToast()

  const dirty =
    title !== section.title ||
    description !== (section.description ?? '') ||
    isActive !== section.is_active

  const save = async () => {
    try {
      await update.mutateAsync({
        id: section.id,
        data: {
          title: title.trim(),
          description: description.trim() || null,
          is_active: isActive,
        },
      })
      showToast('Section saved.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const moveField = async (index: number, direction: -1 | 1) => {
    const next = [...section.fields]
    const target = next[index + direction]
    if (!target) return
    next[index + direction] = next[index]
    next[index] = target
    try {
      await reorderFields.mutateAsync({ sectionId: section.id, ids: next.map((f) => f.id) })
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">Section heading</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700">
              Intro <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              className={`mt-1 ${inputClass}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Ask this section
            <span className="text-xs text-slate-400">
              (turn off to pause it without losing what's already been answered)
            </span>
          </label>
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

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        {section.fields.length === 0 && (
          <p className="text-sm text-slate-400">No questions in this section yet.</p>
        )}
        {section.fields.map((field, i) => (
          <FieldRow
            key={field.id}
            field={field}
            isFirst={i === 0}
            isLast={i === section.fields.length - 1}
            onMove={(direction) => moveField(i, direction)}
          />
        ))}
        <AddFieldForm sectionId={section.id} nextOrder={section.fields.length} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || update.isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {update.isPending ? 'Saving…' : 'Save section'}
        </button>

        {confirmingDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-slate-600">Delete this section and its questions?</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await remove.mutateAsync(section.id)
                  showToast('Section deleted. Past bookings keep their answers.', 'success')
                } catch (err) {
                  showToast(errorMessage(err))
                }
              }}
              className="font-medium text-red-600 hover:text-red-700"
            >
              Delete
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
            Delete section
          </button>
        )}
      </div>
    </li>
  )
}

function FieldRow({
  field,
  isFirst,
  isLast,
  onMove,
}: {
  field: BookingFlowField
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
}) {
  const [label, setLabel] = useState(field.label)
  const [helpText, setHelpText] = useState(field.help_text ?? '')
  const [fieldType, setFieldType] = useState<BookingFieldType>(field.field_type)
  const [isRequired, setIsRequired] = useState(field.is_required)
  const [options, setOptions] = useState<string[]>(field.options)
  const [newOption, setNewOption] = useState('')
  const [bindsTo, setBindsTo] = useState<FieldBinding | ''>(field.binds_to ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const update = useUpdateBookingFlowField()
  const remove = useDeleteBookingFlowField()
  const { showToast } = useToast()

  const needsOptions = OPTION_TYPES.includes(fieldType)
  const dirty =
    label !== field.label ||
    helpText !== (field.help_text ?? '') ||
    fieldType !== field.field_type ||
    isRequired !== field.is_required ||
    bindsTo !== (field.binds_to ?? '') ||
    options.join(' ') !== field.options.join(' ')

  // A binding that writes into a numeric column can only sit on a Number
  // field - the server refuses otherwise, so say so before they save.
  const bindingRequiresNumber = BINDINGS.find((b) => b.value === bindsTo)?.numeric === true
  const bindingMismatch = bindingRequiresNumber && fieldType !== 'NUMBER'

  const save = async () => {
    try {
      await update.mutateAsync({
        id: field.id,
        data: {
          label: label.trim(),
          help_text: helpText.trim() || null,
          field_type: fieldType,
          is_required: isRequired,
          options: needsOptions ? options : [],
          binds_to: bindsTo === '' ? null : bindsTo,
        },
      })
      showToast('Question saved.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const addOption = () => {
    const value = newOption.trim()
    if (!value || options.includes(value)) return
    setOptions([...options, value])
    setNewOption('')
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600">Question</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600">Answer type</span>
              <select
                className={`mt-1 ${inputClass}`}
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as BookingFieldType)}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Hint <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              className={`mt-1 ${inputClass}`}
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
            />
          </label>

          {needsOptions && (
            <div>
              <p className="text-xs font-medium text-slate-600">Choices</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {options.map((option) => (
                  <li
                    key={option}
                    className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200"
                  >
                    {option}
                    <button
                      type="button"
                      aria-label={`Remove ${option}`}
                      onClick={() => setOptions(options.filter((o) => o !== option))}
                      className="text-slate-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex gap-2">
                <input
                  className={inputClass}
                  value={newOption}
                  placeholder="Add a choice"
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addOption()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addOption}
                  disabled={!newOption.trim()}
                  className="rounded-md border border-slate-300 px-3 text-sm disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              {options.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Add at least one choice — otherwise there's nothing for the customer to pick.
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Must be answered
          </label>
          {isRequired && (
            // Worth saying up front rather than letting a business discover it
            // from a half-empty review screen.
            <p className="text-xs text-slate-500">
              Bookings taken over WhatsApp or the phone can't ask this — those arrive marked as not
              collected.
            </p>
          )}

          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Also save this answer to the customer's record{' '}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <select
              className={`mt-1 ${inputClass}`}
              value={bindsTo}
              onChange={(e) => setBindsTo(e.target.value as FieldBinding | '')}
            >
              <option value="">Just keep the answer</option>
              {BINDINGS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          {bindingMismatch && (
            <p className="text-xs text-red-600">
              That only works on a Number question — change the answer type first.
            </p>
          )}
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

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || update.isPending || bindingMismatch || (needsOptions && !options.length)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-40"
        >
          {update.isPending ? 'Saving…' : 'Save question'}
        </button>

        {confirmingDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={async () => {
                try {
                  await remove.mutateAsync(field.id)
                  showToast('Question deleted.', 'success')
                } catch (err) {
                  showToast(errorMessage(err))
                }
              }}
              className="font-medium text-red-600 hover:text-red-700"
            >
              Delete
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
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

function AddFieldForm({ sectionId, nextOrder }: { sectionId: string; nextOrder: number }) {
  const [label, setLabel] = useState('')
  const create = useCreateBookingFlowField()
  const { showToast } = useToast()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    try {
      await create.mutateAsync({ sectionId, data: { label: label.trim(), order: nextOrder } })
      setLabel('')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2 pt-1">
      <label className="flex-1">
        <span className="sr-only">New question</span>
        <input
          className={inputClass}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add a question"
        />
      </label>
      <button
        type="submit"
        disabled={!label.trim() || create.isPending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}

function AddSectionForm({
  nextOrder,
  appointmentTypeId,
}: {
  nextOrder: number
  appointmentTypeId: string | null
}) {
  const [title, setTitle] = useState('')
  const create = useCreateBookingFlowSection()
  const { showToast } = useToast()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await create.mutateAsync({
        title: title.trim(),
        order: nextOrder,
        appointment_type_id: appointmentTypeId,
      })
      setTitle('')
      showToast('Section added.', 'success')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex-1">
        <span className="block text-sm font-medium text-slate-700">Section heading</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. About your appointment"
        />
      </label>
      <button
        type="submit"
        disabled={!title.trim() || create.isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}
