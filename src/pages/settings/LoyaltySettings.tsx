import { useEffect, useState, type FormEvent } from 'react'
import {
  useAppointmentTypes,
  useLoyaltyProgram,
  useUpdateLoyaltyProgram,
} from '../../api/queries'
import type { LoyaltyProgram } from '../../api/loyalty'
import { useToast } from '../../components/Toast'
import { errorMessage, isApiError } from '../../lib/errors'

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'
const saveClass =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'

function ownerError(err: unknown): string {
  return isApiError(err) && err.code === 403
    ? 'Only the business owner can change loyalty settings.'
    : errorMessage(err)
}

export function LoyaltySettings() {
  const { data, isLoading } = useLoyaltyProgram()

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Loyalty</h1>
      <p className="mt-1 text-sm text-slate-500">
        Reward customers for returning. Every completed, qualifying visit counts toward a reward -
        no punch cards to lose.
      </p>

      {isLoading || !data ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="mt-8">
          <ProgramForm program={data} />
        </div>
      )}
    </>
  )
}

function ProgramForm({ program }: { program: LoyaltyProgram }) {
  const update = useUpdateLoyaltyProgram()
  const { data: types = [] } = useAppointmentTypes('ACTIVE')
  const { showToast } = useToast()

  const [enabled, setEnabled] = useState(program.enabled)
  const [name, setName] = useState(program.name)
  const [description, setDescription] = useState(program.description ?? '')
  const [threshold, setThreshold] = useState(String(program.threshold))
  const [rewardPounds, setRewardPounds] = useState((program.reward_value_minor / 100).toFixed(2))
  const [qualifyingAll, setQualifyingAll] = useState(program.qualifying_appointment_type_ids === null)
  const [qualifyingIds, setQualifyingIds] = useState<string[]>(
    program.qualifying_appointment_type_ids ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  // The GET-created default row only exists once someone's looked at this
  // page - re-sync local state if the server row changes under us (e.g. a
  // second tab saved first).
  useEffect(() => {
    setEnabled(program.enabled)
    setName(program.name)
    setDescription(program.description ?? '')
    setThreshold(String(program.threshold))
    setRewardPounds((program.reward_value_minor / 100).toFixed(2))
    setQualifyingAll(program.qualifying_appointment_type_ids === null)
    setQualifyingIds(program.qualifying_appointment_type_ids ?? [])
  }, [program])

  const toggleType = (id: string) => {
    setQualifyingIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const thresholdNum = Number(threshold)
    const rewardMinor = Math.round(Number(rewardPounds) * 100)
    if (!Number.isInteger(thresholdNum) || thresholdNum < 1) {
      setError('Visits required must be at least 1.')
      return
    }
    if (!Number.isFinite(rewardMinor) || rewardMinor < 0) {
      setError('Enter a valid reward amount.')
      return
    }
    if (!name.trim()) {
      setError('Give the programme a name.')
      return
    }

    try {
      await update.mutateAsync({
        enabled,
        name: name.trim(),
        description: description.trim() || null,
        threshold: thresholdNum,
        reward_type: 'FIXED_DISCOUNT',
        reward_value_minor: rewardMinor,
        qualifying_appointment_type_ids: qualifyingAll ? null : qualifyingIds,
      })
      showToast('Loyalty settings saved.', 'success')
    } catch (err) {
      setError(ownerError(err))
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-6">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Loyalty enabled
      </label>

      <label className="block text-sm text-slate-700">
        Programme name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          maxLength={100}
        />
      </label>

      <label className="block text-sm text-slate-700">
        Description for customers (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
          rows={2}
          maxLength={2000}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-700">
          Customers earn 1 stamp per completed visit. Reward after
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className={`${inputClass} mt-0 w-24`}
            />
            <span className="text-sm text-slate-600">visits</span>
          </div>
        </label>

        <label className="block text-sm text-slate-700">
          Reward
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-slate-600">£</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={rewardPounds}
              onChange={(e) => setRewardPounds(e.target.value)}
              className={`${inputClass} mt-0`}
            />
            <span className="text-sm text-slate-600">off</span>
          </div>
        </label>
      </div>

      <fieldset className="space-y-2 text-sm text-slate-700">
        <legend className="text-sm font-medium text-slate-900">Which visits qualify</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={qualifyingAll}
            onChange={() => setQualifyingAll(true)}
          />
          Any service
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={!qualifyingAll}
            onChange={() => setQualifyingAll(false)}
          />
          Only these services
        </label>
        {!qualifyingAll && (
          <div className="ml-6 flex flex-wrap gap-3">
            {types.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={qualifyingIds.includes(t.id)}
                  onChange={() => toggleType(t.id)}
                />
                {t.name}
              </label>
            ))}
            {types.length === 0 && <p className="text-xs text-slate-400">No active services yet.</p>}
          </div>
        )}
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={update.isPending} className={saveClass}>
        {update.isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
