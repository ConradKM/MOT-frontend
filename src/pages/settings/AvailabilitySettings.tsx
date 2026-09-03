import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  useAddScheduleException,
  useDeleteScheduleException,
  useGarageSchedule,
  useUpdateOpeningHours,
  useUpdateScheduleSettings,
} from '../../api/queries'
import type {
  OpeningHoursInput,
  OpeningHoursRow,
  ScheduleException,
  ScheduleSettings,
  ScheduleSettingsInput,
} from '../../api/garageSchedule'
import { errorMessage, isApiError } from '../../lib/errors'
import { useToast } from '../../components/Toast'
import { SettingsLayout } from '../../components/settings/SettingsLayout'
import { formatLongDate, todayIso } from '../../lib/datetime'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'
const timeClass =
  'rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none'

function toTimeInput(value: string): string {
  return value.slice(0, 5)
}

function ownerError(err: unknown): string {
  return isApiError(err) && err.code === 403
    ? 'Only the garage owner can change availability settings.'
    : errorMessage(err)
}

export function AvailabilitySettings() {
  const { data, isLoading } = useGarageSchedule()

  if (isLoading || !data) {
    return (
      <SettingsLayout>
        <p className="text-sm text-slate-500">Loading…</p>
      </SettingsLayout>
    )
  }

  return (
    <SettingsLayout>
      <h1 className="text-2xl font-semibold text-slate-900">Availability</h1>
      <p className="mt-1 text-sm text-slate-500">
        Controls the public booking calendar customers see for your garage.
      </p>

      <div className="mt-8 space-y-10">
        <SlotRulesForm settings={data.settings} />
        <OpeningHoursForm openingHours={data.opening_hours} />
        <ExceptionsSection exceptions={data.exceptions} />
      </div>
    </SettingsLayout>
  )
}

function SlotRulesForm({
  settings,
}: {
  settings: ScheduleSettings
}) {
  const update = useUpdateScheduleSettings()
  const { showToast } = useToast()
  const [form, setForm] = useState({
    slot_interval_minutes: String(settings.slot_interval_minutes),
    default_appointment_minutes: String(settings.default_appointment_minutes),
    min_lead_time_hours: String(settings.min_lead_time_hours),
    max_advance_days: String(settings.max_advance_days),
    capacity_per_slot:
      settings.capacity_per_slot === null ? '' : String(settings.capacity_per_slot),
    limited_threshold_ratio: String(settings.limited_threshold_ratio),
  })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload: ScheduleSettingsInput = {
      slot_interval_minutes: Number(form.slot_interval_minutes),
      default_appointment_minutes: Number(form.default_appointment_minutes),
      min_lead_time_hours: Number(form.min_lead_time_hours),
      max_advance_days: Number(form.max_advance_days),
      capacity_per_slot: form.capacity_per_slot === '' ? null : Number(form.capacity_per_slot),
      limited_threshold_ratio: Number(form.limited_threshold_ratio),
    }
    try {
      await update.mutateAsync(payload)
      showToast('Availability rules saved.', 'success')
    } catch (err) {
      setError(ownerError(err))
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="text-sm font-semibold text-slate-900">Slot rules</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-700">
          Slot length (minutes)
          <input
            type="number"
            min={5}
            value={form.slot_interval_minutes}
            onChange={(e) => set('slot_interval_minutes', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Default appointment length (minutes)
          <input
            type="number"
            min={5}
            value={form.default_appointment_minutes}
            onChange={(e) => set('default_appointment_minutes', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Minimum notice (hours)
          <input
            type="number"
            min={0}
            value={form.min_lead_time_hours}
            onChange={(e) => set('min_lead_time_hours', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Booking window (days ahead)
          <input
            type="number"
            min={1}
            value={form.max_advance_days}
            onChange={(e) => set('max_advance_days', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Bookings per slot
          <input
            type="number"
            min={1}
            placeholder="Auto (number of employees)"
            value={form.capacity_per_slot}
            onChange={(e) => set('capacity_per_slot', e.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-400">
            Leave blank to use your employee count.
          </span>
        </label>
        <label className="block text-sm text-slate-700">
          "Limited" threshold (0–1)
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={form.limited_threshold_ratio}
            onChange={(e) => set('limited_threshold_ratio', e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={update.isPending}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {update.isPending ? 'Saving…' : 'Save slot rules'}
      </button>
    </form>
  )
}

function OpeningHoursForm({
  openingHours,
}: {
  openingHours: OpeningHoursRow[]
}) {
  const update = useUpdateOpeningHours()
  const { showToast } = useToast()
  const initial = useMemo(() => {
    const byWeekday = new Map(openingHours.map((r) => [r.weekday, r]))
    return WEEKDAYS.map((_, weekday) => {
      const row = byWeekday.get(weekday)
      return {
        weekday,
        opens_at: toTimeInput(row?.opens_at ?? '09:00'),
        closes_at: toTimeInput(row?.closes_at ?? '17:00'),
        is_closed: row?.is_closed ?? weekday >= 5,
      }
    })
  }, [openingHours])

  const [rows, setRows] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setRows(initial), [initial])

  const setRow = (weekday: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload: OpeningHoursInput[] = rows.map((r) => ({
      weekday: r.weekday,
      opens_at: r.opens_at,
      closes_at: r.closes_at,
      is_closed: r.is_closed,
    }))
    try {
      await update.mutateAsync(payload)
      showToast('Opening hours saved.', 'success')
    } catch (err) {
      setError(ownerError(err))
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="text-sm font-semibold text-slate-900">Opening hours</h2>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.weekday} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-24 text-slate-700">{WEEKDAYS[r.weekday]}</span>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input
                type="checkbox"
                checked={r.is_closed}
                onChange={(e) => setRow(r.weekday, { is_closed: e.target.checked })}
              />
              Closed
            </label>
            <input
              type="time"
              value={r.opens_at}
              disabled={r.is_closed}
              onChange={(e) => setRow(r.weekday, { opens_at: e.target.value })}
              className={`${timeClass} disabled:opacity-40`}
            />
            <span className="text-slate-400">to</span>
            <input
              type="time"
              value={r.closes_at}
              disabled={r.is_closed}
              onChange={(e) => setRow(r.weekday, { closes_at: e.target.value })}
              className={`${timeClass} disabled:opacity-40`}
            />
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={update.isPending}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {update.isPending ? 'Saving…' : 'Save opening hours'}
      </button>
    </form>
  )
}

function ExceptionsSection({
  exceptions,
}: {
  exceptions: ScheduleException[]
}) {
  const add = useAddScheduleException()
  const remove = useDeleteScheduleException()
  const { showToast } = useToast()
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!date) {
      setError('Pick a date.')
      return
    }
    try {
      await add.mutateAsync({ date, is_closed: true, note: note || null })
      setDate('')
      setNote('')
      showToast('Closure added.', 'success')
    } catch (err) {
      setError(ownerError(err))
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">One-off closures</h2>
      <p className="mt-1 text-xs text-slate-400">
        Bank holidays or other days the garage is shut, on top of the weekly hours above.
      </p>

      <ul className="mt-3 space-y-1.5">
        {exceptions.length === 0 && (
          <li className="text-sm text-slate-400">No closures added.</li>
        )}
        {exceptions.map((exc) => (
          <li
            key={exc.id}
            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
            <span>
              {formatLongDate(exc.date)}
              {exc.note ? ` — ${exc.note}` : ''}
              {!exc.is_closed && ' (special hours)'}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await remove.mutateAsync(exc.id)
                } catch (err) {
                  showToast(ownerError(err))
                }
              }}
              className="text-xs font-medium text-slate-500 hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-700">
          Date
          <input
            type="date"
            min={todayIso()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm text-slate-700">
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={add.isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Add closure
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
