import { useEffect, useRef, useState } from 'react'
import { useToast } from '../../../components/Toast'
import { errorMessage, fieldErrors, isApiError } from '../../../lib/errors'
import { useUpdateVehicleDetails, useVehicleDetails } from '../../../api/vehicleDetailsQueries'
import type { VehicleDetailKey, VehicleDetailState } from '../../../api/vehicleDetails'
import {
  ExpandToggle,
  closeOnEscape,
  useExpandFocus,
} from '../../../components/settings/ExpandableRow'
import { SectionHeading, SettingsCard } from '../../../components/settings/SettingsUI'

const ROWS: { key: VehicleDetailKey; label: string; hint: string }[] = [
  { key: 'registration', label: 'Registration number', hint: 'e.g. AB12 CDE' },
  { key: 'make', label: 'Make', hint: 'e.g. Ford' },
  { key: 'model', label: 'Model', hint: 'e.g. Focus' },
]

type FormState = Record<VehicleDetailKey, VehicleDetailState>

/**
 * The one-screen answer to "how do I ask customers for their car?". Each
 * switch is an ordinary question in the business's default workflow (it
 * appears in the list below too), bound so the answer lands on the booking
 * and the customer's vehicle record. Nothing is asked until the owner turns
 * it on - a business that doesn't book vehicles never sees these questions.
 */
export function VehicleDetailsCard() {
  const { data, isLoading } = useVehicleDetails()
  const update = useUpdateVehicleDetails()
  const { showToast } = useToast()
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const editRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useExpandFocus(editing, panelRef, editRef)

  useEffect(() => {
    if (data) setForm(data.fields)
  }, [data])

  if (isLoading || !form || !data) return null

  const dirty = ROWS.some(
    ({ key }) =>
      form[key].enabled !== data.fields[key].enabled ||
      form[key].required !== data.fields[key].required,
  )

  const set = (key: VehicleDetailKey, patch: Partial<VehicleDetailState>) =>
    setForm((f) => {
      if (!f) return f
      const next = { ...f, [key]: { ...f[key], ...patch } }
      if (patch.enabled === false) next[key].required = false
      // Make and model are recorded against the registration.
      if (key === 'registration' && patch.enabled === false) {
        next.make = { enabled: false, required: false }
        next.model = { enabled: false, required: false }
      }
      if (key !== 'registration' && patch.enabled) {
        next.registration = { ...next.registration, enabled: true }
      }
      return next
    })

  const save = async () => {
    setError(null)
    try {
      await update.mutateAsync(form)
      showToast('Vehicle details saved.', 'success')
      setEditing(false)
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setError('Only an owner can change what customers are asked.')
        return
      }
      setError(Object.values(fieldErrors(err))[0] ?? errorMessage(err))
    }
  }

  const cancel = () => {
    setForm(data.fields)
    setError(null)
    setEditing(false)
  }
  const asked = ROWS.filter(({ key }) => data.fields[key].enabled)

  return (
    <SettingsCard as="section" aria-labelledby="vehicle-details-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading
          as="h3"
          id="vehicle-details-heading"
          title="Vehicle details"
          info="Ask customers which vehicle they're booking in. Answers are saved on the booking request and the customer's vehicle record, and the phone assistant asks for the same details."
        />
        {!editing && (
          <ExpandToggle
            ref={editRef}
            aria-expanded={false}
            aria-controls={undefined}
            onClick={() => setEditing(true)}
            label="Edit"
          />
        )}
      </div>

      {!editing && (
        <p className="mt-2 text-sm text-slate-700" data-testid="vehicle-details-summary">
          {asked.length === 0
            ? 'Not asked.'
            : `Asks for ${asked
                .map(
                  ({ key, label }) =>
                    `${label.toLowerCase()}${data.fields[key].required ? ' (required)' : ''}`,
                )
                .join(', ')}.`}
        </p>
      )}

      {data.services_with_own_workflow > 0 && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {data.services_with_own_workflow === 1
            ? 'One service has its own questions'
            : `${data.services_with_own_workflow} services have their own questions`}{' '}
          and won't pick this up - add the vehicle questions to those services too.
        </p>
      )}

      {editing && (
        <div
          ref={panelRef}
          role="region"
          aria-label="Edit vehicle details"
          onKeyDown={closeOnEscape(cancel)}
        >
          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <ul className="mt-3 divide-y divide-slate-100">
            {ROWS.map(({ key, label, hint }) => (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={form[key].enabled}
                    onChange={(e) => set(key, { enabled: e.target.checked })}
                  />
                  <span>
                    Ask for <strong>{label.toLowerCase()}</strong>{' '}
                    <span className="text-slate-600">({hint})</span>
                  </span>
                </label>
                <label
                  className={`flex items-center gap-2 text-sm ${
                    form[key].enabled ? 'text-slate-700' : 'text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={form[key].required}
                    disabled={!form[key].enabled}
                    onChange={(e) => set(key, { required: e.target.checked })}
                    aria-label={`${label} required`}
                  />
                  Required
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || update.isPending}
              className="min-h-11 rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:min-h-0"
            >
              {update.isPending ? 'Saving…' : 'Save vehicle details'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="min-h-11 rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:min-h-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </SettingsCard>
  )
}
