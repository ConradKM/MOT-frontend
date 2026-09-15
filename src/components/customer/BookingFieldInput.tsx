import { useId } from 'react'
import type { BookingFlowField, BookingFlowSection } from '../../api/publicGarage'
import { RichTextInput } from '../rich/RichTextInput'
import { richFieldBoxClass, richFieldFocusClass } from '../rich/richFieldStyles'

/** One field's answer, held as it is typed. `values` is only ever used by
 * MULTI_SELECT; which of the two is read is decided by the field's type, not
 * by which one happens to be set. */
export interface AnswerState {
  value: string
  values: string[]
}

export type AnswerMap = Record<string, AnswerState>

export const emptyAnswer: AnswerState = { value: '', values: [] }

/** Seed state for a workflow, so every configured field has an entry before
 * the customer touches anything. */
export function initialAnswers(sections: BookingFlowSection[]): AnswerMap {
  const out: AnswerMap = {}
  for (const section of sections) {
    for (const field of section.fields) out[field.id] = { ...emptyAnswer }
  }
  return out
}

/**
 * Client-side validation of the configured fields.
 *
 * A convenience only - it saves a round trip and puts the message next to the
 * field. The server validates the same rules against the same configuration
 * and is the authority; see app/booking_flow/answers.py.
 */
export function validateAnswers(
  sections: BookingFlowSection[],
  answers: AnswerMap,
): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const section of sections) {
    for (const field of section.fields) {
      const answer = answers[field.id] ?? emptyAnswer
      const isMulti = field.field_type === 'MULTI_SELECT'
      const empty = isMulti ? answer.values.length === 0 : !answer.value.trim()

      if (field.is_required && empty) {
        errors[field.id] = `${field.label} is required.`
        continue
      }
      if (empty) continue

      if (field.field_type === 'NUMBER') {
        const n = Number(answer.value)
        if (!Number.isInteger(n)) {
          errors[field.id] = `${field.label} must be a whole number.`
        } else if (field.min_value != null && n < field.min_value) {
          errors[field.id] = `${field.label} must be at least ${field.min_value}.`
        } else if (field.max_value != null && n > field.max_value) {
          errors[field.id] = `${field.label} must be at most ${field.max_value}.`
        }
      }

      if (
        field.max_length != null &&
        !isMulti &&
        answer.value.trim().length > field.max_length
      ) {
        errors[field.id] = `${field.label} must be ${field.max_length} characters or fewer.`
      }
    }
  }

  return errors
}

/** Turn held answers into the submission shape. Empty scalars are sent as
 * null rather than "" so the server records "asked and skipped" cleanly. */
export function toAnswerInput(sections: BookingFlowSection[], answers: AnswerMap) {
  return sections.flatMap((section) =>
    section.fields.map((field) => {
      const answer = answers[field.id] ?? emptyAnswer
      return field.field_type === 'MULTI_SELECT'
        ? { field_id: field.id, values: answer.values }
        : { field_id: field.id, value: answer.value.trim() || null }
    }),
  )
}

export function BookingSection({
  section,
  answers,
  errors,
  onChange,
}: {
  section: BookingFlowSection
  answers: AnswerMap
  errors: Record<string, string>
  onChange: (fieldId: string, next: AnswerState) => void
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
      {section.description && (
        <p className="mt-1 text-sm text-slate-500">{section.description}</p>
      )}
      <div className="mt-4 space-y-4">
        {section.fields.map((field) => (
          <BookingFieldInput
            key={field.id}
            field={field}
            answer={answers[field.id] ?? emptyAnswer}
            error={errors[field.id]}
            onChange={(next) => onChange(field.id, next)}
          />
        ))}
      </div>
    </section>
  )
}

export function BookingFieldInput({
  field,
  answer,
  error,
  onChange,
}: {
  field: BookingFlowField
  answer: AnswerState
  error?: string
  onChange: (next: AnswerState) => void
}) {
  const id = useId()
  const errorId = `${id}-error`
  const helpId = `${id}-help`
  const describedBy = [error ? errorId : null, field.help_text ? helpId : null]
    .filter(Boolean)
    .join(' ')

  const control = {
    id,
    'aria-describedby': describedBy || undefined,
    'aria-invalid': error ? true : undefined,
  }

  const setValue = (value: string) => onChange({ ...answer, value })

  return (
    <div>
      {/* A CHECKBOX labels itself next to the box; everything else gets a
          label above the control. */}
      {field.field_type !== 'CHECKBOX' && (
        <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
          {field.label}{' '}
          {field.is_required ? (
            <span className="text-red-500">*</span>
          ) : (
            <span className="text-xs font-normal text-slate-400">(optional)</span>
          )}
        </label>
      )}

      <div className={field.field_type === 'CHECKBOX' ? '' : 'mt-1'}>
        {renderControl(field, answer, setValue, onChange, control, id)}
      </div>

      {field.help_text && (
        <p id={helpId} className="mt-1 text-xs text-slate-500">
          {field.help_text}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

type ControlProps = {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': boolean | undefined
}

function renderControl(
  field: BookingFlowField,
  answer: AnswerState,
  setValue: (value: string) => void,
  onChange: (next: AnswerState) => void,
  control: ControlProps,
  id: string,
) {
  switch (field.field_type) {
    case 'TEXTAREA':
      return (
        <textarea
          {...control}
          rows={3}
          value={answer.value}
          maxLength={field.max_length ?? undefined}
          placeholder={field.placeholder ?? undefined}
          onChange={(e) => setValue(e.target.value)}
          className={`${richFieldBoxClass} ${richFieldFocusClass}`}
        />
      )

    case 'SELECT':
      return (
        <select
          {...control}
          value={answer.value}
          onChange={(e) => setValue(e.target.value)}
          className={`${richFieldBoxClass} ${richFieldFocusClass}`}
        >
          <option value="">Please choose…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )

    case 'MULTI_SELECT':
      return (
        <fieldset>
          <legend className="sr-only">{field.label}</legend>
          <div className="space-y-1">
            {field.options.map((option) => {
              const checked = answer.values.includes(option)
              return (
                <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange({
                        ...answer,
                        values: checked
                          ? answer.values.filter((v) => v !== option)
                          : [...answer.values, option],
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {option}
                </label>
              )
            })}
          </div>
        </fieldset>
      )

    case 'CHECKBOX':
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor={id}>
          <input
            {...control}
            type="checkbox"
            checked={answer.value === 'true'}
            onChange={(e) => setValue(e.target.checked ? 'true' : '')}
            className="h-4 w-4 rounded border-slate-300"
          />
          {field.label}
          {field.is_required && <span className="text-red-500">*</span>}
        </label>
      )

    // The business's own date question - a delivery date, a date of birth -
    // not the appointment date, which the wizard asks separately.
    case 'DATE':
    case 'TIME':
    case 'NUMBER':
    case 'EMAIL':
    case 'PHONE':
      return (
        <RichTextInput
          {...control}
          type={inputTypeFor(field.field_type)}
          value={answer.value}
          min={field.min_value ?? undefined}
          max={field.max_value ?? undefined}
          placeholder={field.placeholder ?? undefined}
          onChange={setValue}
        />
      )

    // PHOTO falls through to a text control for now: uploading from the
    // public booking page needs its own presigned flow, and a half-working
    // file input would be worse than a field a business can still ask in
    // words. Configuring one is possible; collecting the file is not yet.
    default:
      return (
        <RichTextInput
          {...control}
          value={answer.value}
          maxLength={field.max_length ?? undefined}
          placeholder={field.placeholder ?? undefined}
          onChange={setValue}
        />
      )
  }
}

type RichInputType = 'text' | 'email' | 'tel' | 'number' | 'date' | 'time'

function inputTypeFor(fieldType: BookingFlowField['field_type']): RichInputType {
  if (fieldType === 'DATE') return 'date'
  if (fieldType === 'TIME') return 'time'
  if (fieldType === 'NUMBER') return 'number'
  if (fieldType === 'EMAIL') return 'email'
  if (fieldType === 'PHONE') return 'tel'
  return 'text'
}
