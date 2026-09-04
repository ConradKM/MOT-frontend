import { useEffect, useState, type FormEvent } from 'react'
import { useMOTReminderSettings, useUpdateMOTReminderSettings } from '../../api/queries'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import type { MOTReminderSettings } from '../../api/motReminders'

const STAGES = [
  { key: 'stage1', label: 'First reminder' },
  { key: 'stage2', label: 'Second reminder' },
  { key: 'stage3', label: 'Final reminder' },
] as const

interface StageForm {
  enabled: boolean
  days: string
}

function toForm(s: MOTReminderSettings): Record<string, StageForm> {
  return {
    stage1: { enabled: s.stage1_enabled, days: String(s.stage1_days_before) },
    stage2: { enabled: s.stage2_enabled, days: String(s.stage2_days_before) },
    stage3: { enabled: s.stage3_enabled, days: String(s.stage3_days_before) },
  }
}

export function MotReminderSettings() {
  const { data, isLoading } = useMOTReminderSettings()
  const update = useUpdateMOTReminderSettings()
  const { showToast } = useToast()

  const [form, setForm] = useState<Record<string, StageForm>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data) setForm(toForm(data))
  }, [data])

  if (isLoading || !data || Object.keys(form).length === 0) {
    return (
      <SettingsLayout>
        <p className="text-sm text-slate-500">Loading…</p>
      </SettingsLayout>
    )
  }

  const setStage = (key: string, patch: Partial<StageForm>) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const enabledDays = STAGES.filter((s) => form[s.key].enabled).map((s) =>
      Number(form[s.key].days),
    )
    if (enabledDays.some((n) => !Number.isInteger(n) || n < 1)) {
      setError('Reminder intervals must be whole numbers of 1 day or more.')
      return
    }
    if (new Set(enabledDays).size !== enabledDays.length) {
      setError('Enabled reminders must use different intervals.')
      return
    }

    try {
      await update.mutateAsync({
        stage1_enabled: form.stage1.enabled,
        stage1_days_before: Number(form.stage1.days),
        stage2_enabled: form.stage2.enabled,
        stage2_days_before: Number(form.stage2.days),
        stage3_enabled: form.stage3.enabled,
        stage3_days_before: Number(form.stage3.days),
      })
      showToast('Reminder schedule saved.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setError('Only the garage owner can change the reminder schedule.')
        return
      }
      const fields = fieldErrors(err)
      setError(Object.values(fields)[0] ?? errorMessage(err))
    }
  }

  return (
    <SettingsLayout>
      <div className="max-w-lg">
        <h1 className="text-2xl font-semibold text-slate-900">MOT reminders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Automatically remind customers before their MOT expires. Reminders stop
          automatically when the vehicle has an active MOT booking.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {STAGES.map((s) => {
            const stage = form[s.key]
            return (
              <div
                key={s.key}
                className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-3"
              >
                <input
                  id={`${s.key}-enabled`}
                  type="checkbox"
                  checked={stage.enabled}
                  onChange={(e) => setStage(s.key, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label
                  htmlFor={`${s.key}-enabled`}
                  className="w-32 text-sm font-medium text-slate-700"
                >
                  {s.label}
                </label>
                <input
                  aria-label={`${s.label} days before expiry`}
                  type="number"
                  min={1}
                  max={365}
                  value={stage.days}
                  disabled={!stage.enabled}
                  onChange={(e) => setStage(s.key, { days: e.target.value })}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
                <span className="text-sm text-slate-500">days before MOT expiry</span>
              </div>
            )
          })}

          <p className="text-xs text-slate-400">
            Stages are shown furthest-out first. A customer can receive up to three
            automatic reminders per MOT cycle.
          </p>

          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save reminder settings'}
          </button>
        </form>
      </div>
    </SettingsLayout>
  )
}
