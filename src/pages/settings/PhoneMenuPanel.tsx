import { useEffect, useState } from 'react'
import { useToast } from '../../components/Toast'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useUpdateVoiceMenu, useVoiceMenu } from '../../api/voiceMenuQueries'
import type {
  VoiceMenu,
  VoiceMenuAction,
  VoiceMenuInput,
  VoiceMenuOption,
} from '../../api/voiceMenu'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const MAX_ATTEMPTS = [1, 2, 3, 4, 5]
const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none'

/** A starting menu for a business that hasn't set one up - the common
 * "press 1 to book, press 2 to speak to us" shape. Nothing is saved until
 * the owner presses Save. */
const STARTER_OPTIONS: VoiceMenuOption[] = [
  { digit: '1', label: 'bookings', prompt: null, action: 'AI_BOOKING', target: null },
  { digit: '2', label: 'the team', prompt: null, action: 'HUMAN_TRANSFER', target: null },
]

function toInput(menu: VoiceMenu): VoiceMenuInput {
  return {
    enabled: menu.enabled,
    greeting: menu.greeting,
    options: menu.options.length ? menu.options : STARTER_OPTIONS,
    fallback_action: menu.fallback_action,
    fallback_target: menu.fallback_target,
    max_attempts: menu.max_attempts,
  }
}

function spokenPrompt(option: VoiceMenuOption): string {
  return option.prompt?.trim() || `For ${option.label || '…'}, press ${option.digit}.`
}

/**
 * Settings › Communications › Phone menu. What callers hear and can press
 * before anything else happens - so someone who wants a person reaches one
 * without talking to the assistant first.
 */
export function PhoneMenuPanel({ businessName }: { businessName?: string }) {
  const { data, isLoading, error: loadError } = useVoiceMenu()
  const update = useUpdateVoiceMenu()
  const { showToast } = useToast()
  const [form, setForm] = useState<VoiceMenuInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorsByField, setErrorsByField] = useState<Record<string, string>>({})

  useEffect(() => {
    if (data) setForm(toInput(data))
  }, [data])

  if (isLoading) return <p className="text-sm text-slate-500">Loading phone menu…</p>
  if (loadError || !data || !form) {
    return <p className="text-sm text-slate-500">The phone menu isn't available right now.</p>
  }

  const actions = data.supported_actions
  const actionInfo = (key: VoiceMenuAction) => actions.find((a) => a.key === key)
  const usedDigits = new Set(form.options.map((o) => o.digit))

  const setOption = (index: number, patch: Partial<VoiceMenuOption>) =>
    setForm((f) =>
      f
        ? {
            ...f,
            options: f.options.map((o, i) => {
              if (i !== index) return o
              const next = { ...o, ...patch }
              if (patch.action && !actionInfo(patch.action)?.accepts_target) next.target = null
              return next
            }),
          }
        : f,
    )

  const addOption = () =>
    setForm((f) => {
      if (!f) return f
      const digit = DIGITS.find((d) => !f.options.some((o) => o.digit === d))
      if (!digit) return f
      return {
        ...f,
        options: [
          ...f.options,
          { digit, label: '', prompt: null, action: 'HUMAN_TRANSFER', target: null },
        ],
      }
    })

  const removeOption = (index: number) =>
    setForm((f) => (f ? { ...f, options: f.options.filter((_, i) => i !== index) } : f))

  const save = async () => {
    setError(null)
    setErrorsByField({})
    try {
      await update.mutateAsync({
        ...form,
        greeting: form.greeting?.trim() || null,
        fallback_target: form.fallback_target?.trim() || null,
        options: form.options.map((o) => ({
          ...o,
          label: o.label.trim(),
          prompt: o.prompt?.trim() || null,
          target: o.target?.trim() || null,
        })),
      })
      showToast('Phone menu saved.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setError('Only the business owner can change the phone menu.')
        return
      }
      const fields = fieldErrors(err)
      setErrorsByField(fields)
      setError(Object.values(fields)[0] ?? errorMessage(err))
    }
  }

  const greeting = form.greeting?.trim() || `Thanks for calling ${businessName || 'us'}.`
  const preview = [greeting, ...form.options.map(spokenPrompt)].join(' ')
  const aiChosen = form.options.some((o) => o.action === 'AI_BOOKING' || o.action === 'AI_FAQ')

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-medium text-slate-700">
            Play a phone menu when customers call
          </span>
          <span className="block text-xs text-slate-500">
            Callers hear your greeting and choose an option on their keypad before anything else
            happens. Off: calls work exactly as they do today.
          </span>
        </span>
      </label>

      {aiChosen && !data.ai_available && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The phone assistant isn't switched on for your number yet. Until it is, callers who
          choose it are sent to your fallback instead.
        </p>
      )}

      <label className="block">
        <span className="block text-sm font-medium text-slate-700">Greeting</span>
        <textarea
          className={`mt-1 ${inputClass}`}
          rows={2}
          maxLength={500}
          placeholder={`Thanks for calling ${businessName || 'us'}.`}
          value={form.greeting ?? ''}
          onChange={(e) => setForm({ ...form, greeting: e.target.value })}
        />
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">Options</legend>
        {form.options.map((option, index) => {
          const info = actionInfo(option.action)
          const prefix = `options.${index}`
          return (
            <div
              key={index}
              className="space-y-2 rounded-md border border-slate-200 p-3"
              data-testid="phone-menu-option"
            >
              <div className="flex flex-wrap items-end gap-2">
                <label className="w-20">
                  <span className="block text-xs text-slate-500">Key</span>
                  <select
                    aria-label={`Option ${index + 1} key`}
                    className={`mt-1 ${inputClass}`}
                    value={option.digit}
                    onChange={(e) => setOption(index, { digit: e.target.value })}
                  >
                    {DIGITS.filter((d) => d === option.digit || !usedDigits.has(d)).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-40 flex-1">
                  <span className="block text-xs text-slate-500">Name</span>
                  <input
                    aria-label={`Option ${index + 1} name`}
                    className={`mt-1 ${inputClass}`}
                    maxLength={60}
                    placeholder="bookings"
                    value={option.label}
                    onChange={(e) => setOption(index, { label: e.target.value })}
                  />
                </label>
                <label className="min-w-48 flex-1">
                  <span className="block text-xs text-slate-500">What happens</span>
                  <select
                    aria-label={`Option ${index + 1} action`}
                    className={`mt-1 ${inputClass}`}
                    value={option.action}
                    onChange={(e) =>
                      setOption(index, { action: e.target.value as VoiceMenuAction })
                    }
                  >
                    {actions.map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.label}
                        {a.available ? '' : ' (not available yet)'}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  aria-label={`Remove option ${index + 1}`}
                >
                  Remove
                </button>
              </div>
              {info?.accepts_target && (
                <label className="block">
                  <span className="block text-xs text-slate-500">Transfer to (UK number)</span>
                  <input
                    aria-label={`Option ${index + 1} transfer number`}
                    className={`mt-1 ${inputClass}`}
                    inputMode="tel"
                    placeholder="e.g. 0161 222 3333"
                    value={option.target ?? ''}
                    onChange={(e) => setOption(index, { target: e.target.value })}
                  />
                  {errorsByField[`${prefix}.target`] && (
                    <span className="mt-1 block text-xs text-red-600">
                      {errorsByField[`${prefix}.target`]}
                    </span>
                  )}
                </label>
              )}
              <label className="block">
                <span className="block text-xs text-slate-500">
                  What callers hear (optional) - default: "{spokenPrompt({ ...option, prompt: null })}"
                </span>
                <input
                  aria-label={`Option ${index + 1} spoken prompt`}
                  className={`mt-1 ${inputClass}`}
                  maxLength={200}
                  value={option.prompt ?? ''}
                  onChange={(e) => setOption(index, { prompt: e.target.value })}
                />
              </label>
            </div>
          )
        })}
        <button
          type="button"
          onClick={addOption}
          disabled={form.options.length >= DIGITS.length}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Add option
        </button>
      </fieldset>

      <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">
          If the caller doesn't choose, or something isn't available
        </legend>
        <div className="flex flex-wrap gap-2">
          <label className="min-w-48 flex-1">
            <span className="block text-xs text-slate-500">Then</span>
            <select
              aria-label="Fallback action"
              className={`mt-1 ${inputClass}`}
              value={form.fallback_action}
              onChange={(e) =>
                setForm({ ...form, fallback_action: e.target.value as VoiceMenuAction })
              }
            >
              {actions
                .filter((a) => a.can_be_fallback)
                .map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="w-40">
            <span className="block text-xs text-slate-500">After this many tries</span>
            <select
              aria-label="Attempts before fallback"
              className={`mt-1 ${inputClass}`}
              value={form.max_attempts}
              onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) })}
            >
              {MAX_ATTEMPTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="block text-xs text-slate-500">
            Fallback number (optional - otherwise your first transfer option's number)
          </span>
          <input
            aria-label="Fallback number"
            className={`mt-1 ${inputClass}`}
            inputMode="tel"
            value={form.fallback_target ?? ''}
            onChange={(e) => setForm({ ...form, fallback_target: e.target.value })}
          />
          {errorsByField.fallback_target && (
            <span className="mt-1 block text-xs text-red-600">{errorsByField.fallback_target}</span>
          )}
        </label>
        <p className="text-xs text-slate-500">
          If the assistant can't help or stops working mid-call, the caller is put through to a
          person the same way. If nobody answers, we log a callback request for your team.
        </p>
      </fieldset>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
          Callers will hear
        </span>
        <span data-testid="phone-menu-preview">{preview}</span>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={update.isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {update.isPending ? 'Saving…' : 'Save phone menu'}
      </button>
    </div>
  )
}
