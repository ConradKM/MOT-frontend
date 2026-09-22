import { useEffect, useState, type FormEvent } from 'react'
import {
  useAppointmentReminderSettings,
  useUpdateAppointmentReminderSettings,
} from '../../api/queries'
import { errorMessage, fieldErrors, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import type {
  AppointmentReminderSettings,
  AppointmentReminderTiming,
  ReminderChannel,
} from '../../api/appointmentReminders'

const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

const MIN_HOURS = 1
const MAX_HOURS = 168

interface FormTiming extends AppointmentReminderTiming {
  key: string
}

function toFormTimings(timings: AppointmentReminderTiming[]): FormTiming[] {
  return timings.map((t, i) => ({ ...t, key: t.id ?? `new-${i}-${t.hours_before}` }))
}

function TimingsEditor({
  timings,
  onChange,
}: {
  timings: FormTiming[]
  onChange: (next: FormTiming[]) => void
}) {
  const addTiming = () => {
    onChange([
      ...timings,
      { id: null, hours_before: 24, enabled: true, key: `new-${Date.now()}` },
    ])
  }

  const updateTiming = (key: string, changes: Partial<FormTiming>) => {
    onChange(timings.map((t) => (t.key === key ? { ...t, ...changes } : t)))
  }

  const removeTiming = (key: string) => {
    onChange(timings.filter((t) => t.key !== key))
  }

  return (
    <div className="space-y-2">
      {timings.map((t, i) => (
        <div
          key={t.key}
          className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2"
        >
          <input
            type="checkbox"
            checked={t.enabled}
            onChange={(e) => updateTiming(t.key, { enabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
            aria-label={`Enable timing ${i + 1}`}
          />
          <input
            type="number"
            min={MIN_HOURS}
            max={MAX_HOURS}
            value={t.hours_before}
            disabled={!t.enabled}
            onChange={(e) => updateTiming(t.key, { hours_before: Number(e.target.value) })}
            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
            aria-label={`Timing ${i + 1} hours before`}
          />
          <span className="flex-1 text-sm text-slate-500">hours before the appointment</span>
          <button
            type="button"
            onClick={() => removeTiming(t.key)}
            className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-red-600"
            aria-label={`Remove timing ${i + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addTiming}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        + Add another timing
      </button>
    </div>
  )
}

function ChannelPicker({
  available,
  selected,
  onChange,
}: {
  available: ReminderChannel[]
  selected: ReminderChannel[]
  onChange: (next: ReminderChannel[]) => void
}) {
  const allChannels: ReminderChannel[] = ['email', 'sms', 'whatsapp']

  const toggle = (channel: ReminderChannel, checked: boolean) => {
    if (checked) {
      onChange([...selected.filter((c) => c !== channel), channel])
    } else {
      onChange(selected.filter((c) => c !== channel))
    }
  }

  return (
    <div className="space-y-2">
      {allChannels.map((channel) => {
        const isAvailable = available.includes(channel)
        return (
          <label
            key={channel}
            className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
              isAvailable ? 'border-slate-200' : 'border-slate-100 bg-slate-50'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(channel)}
              disabled={!isAvailable}
              onChange={(e) => toggle(channel, e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
              aria-label={CHANNEL_LABEL[channel]}
            />
            <span
              className={`text-sm font-medium ${isAvailable ? 'text-slate-700' : 'text-slate-400'}`}
            >
              {CHANNEL_LABEL[channel]}
            </span>
            {!isAvailable && (
              <span className="text-xs text-slate-400">Not set up for your business yet</span>
            )}
          </label>
        )
      })}
    </div>
  )
}

function AppointmentRemindersForm({ settings }: { settings: AppointmentReminderSettings }) {
  const update = useUpdateAppointmentReminderSettings()
  const { showToast } = useToast()
  const [enabled, setEnabled] = useState(settings.enabled)
  const [channels, setChannels] = useState<ReminderChannel[]>(settings.channels)
  const [timings, setTimings] = useState<FormTiming[]>(toFormTimings(settings.timings))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEnabled(settings.enabled)
    setChannels(settings.channels)
    setTimings(toFormTimings(settings.timings))
  }, [settings])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await update.mutateAsync({
        enabled,
        channels,
        timings: timings.map((t) => ({ hours_before: t.hours_before, enabled: t.enabled })),
      })
      showToast('Appointment reminder settings saved.', 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 403) {
        setError('Only the business owner can change reminder settings.')
        return
      }
      const fields = fieldErrors(err)
      setError(Object.values(fields)[0] ?? errorMessage(err))
    }
  }

  const enabledTimings = timings.filter((t) => t.enabled).map((t) => t.hours_before)
  const enabledChannelLabels = channels.map((c) => CHANNEL_LABEL[c]).join(', ')

  return (
    <form className="max-w-2xl space-y-6" onSubmit={handleSubmit}>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3">
        <input
          id="appointment-reminders-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
          aria-label="Send automatic appointment reminders"
        />
        <label htmlFor="appointment-reminders-enabled" className="flex-1">
          <p className="text-sm font-medium text-slate-700">Send automatic appointment reminders</p>
          <p className="text-xs text-slate-500">
            Customers get a reminder before their appointment, on the timings and channels below.
          </p>
        </label>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900">When to remind</h2>
        <p className="mt-1 text-xs text-slate-500">
          Add as many lead times as you like - e.g. a day before and again a couple of hours
          before.
        </p>
        <div className="mt-3">
          <TimingsEditor timings={timings} onChange={setTimings} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900">How to remind</h2>
        <p className="mt-1 text-xs text-slate-500">
          The first available channel in this order that this customer has contact details for is
          used. A channel only appears here once it's actually set up for your business.
        </p>
        <div className="mt-3">
          <ChannelPicker
            available={settings.available_channels}
            selected={channels}
            onChange={setChannels}
          />
        </div>
      </div>

      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {enabled && enabledTimings.length > 0 && channels.length > 0 ? (
          <>
            Customers will be reminded {enabledTimings.sort((a, b) => b - a).join('h and ')}h
            before their appointment, via {enabledChannelLabels || 'no channel yet'}.
          </>
        ) : (
          'Appointment reminders will not be sent until this is enabled, with at least one timing and one channel.'
        )}
      </div>

      <button
        type="submit"
        disabled={update.isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {update.isPending ? 'Saving…' : 'Save reminder settings'}
      </button>
    </form>
  )
}

export function AppointmentRemindersSettings() {
  const { data: settings, isLoading, isError } = useAppointmentReminderSettings()

  if (isLoading || !settings) {
    return <p className="text-sm text-slate-500">Loading…</p>
  }
  if (isError) {
    return <p className="text-sm text-red-600">Failed to load appointment reminder settings.</p>
  }

  return <AppointmentRemindersForm settings={settings} />
}
