import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useAddReservedWindow,
  useAppointmentTypes,
  useDeleteReservedWindow,
  useQueueSettings,
  useReservedWindows,
  useUpdateQueueSettings,
} from '../../api/queries'
import type { AverageMode, QueueSettings, ReservedWindow } from '../../api/queue'
import { BookingQrCard } from '../../components/BookingQrCard'
import { InfoTip } from '../../components/settings/InfoTip'
import { FieldLabel, SectionHeading, SettingsPageHeader } from '../../components/settings/SettingsUI'
import { useToast } from '../../components/Toast'
import { useGarageId } from '../../hooks/useGarageId'
import { queueUrl } from '../../lib/bookingUrl'
import { formatLongDate, todayIso } from '../../lib/datetime'
import { errorMessage, isApiError } from '../../lib/errors'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'
const saveClass =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'

function ownerError(err: unknown): string {
  return isApiError(err) && err.code === 403
    ? 'Only the business owner can change walk-in queue settings.'
    : errorMessage(err)
}

export function WalkInQueueSettings() {
  const garageId = useGarageId()
  const { data, isLoading } = useQueueSettings()

  return (
    <>
      <SettingsPageHeader
        title="Walk-in Queue"
        description={
          <>
            How walk-in waits are estimated, and time you keep free for walk-ins. Open and close
            the queue itself from the{' '}
            <Link to={`/${garageId}/queue`} className="underline">
              Queue
            </Link>{' '}
            page.
          </>
        }
      />

      {isLoading || !data ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="mt-8 space-y-10">
          <EstimatesForm settings={data} />
          <JoinFieldsForm settings={data} />
          <ReservedWindowsSection capacity={data.capacity} />
        </div>
      )}

      <BookingQrCard
        garageId={garageId}
        url={queueUrl(garageId)}
        title="Walk-in queue link"
        description="Print this QR code for your reception or forecourt. Customers scan it to join the queue and watch their place — no account needed."
        filenameStem="walk-in-queue-qr"
        qrLabel="Walk-in queue QR code"
      />
    </>
  )
}

function JoinFieldsForm({ settings }: { settings: QueueSettings }) {
  const update = useUpdateQueueSettings()
  const { showToast } = useToast()
  type JoinField = { key: string; label: string; enabled: boolean; required: boolean }
  const [fields, setFields] = useState<JoinField[]>(() => [
    { key: 'name', label: 'Name', enabled: settings.collect_name, required: settings.name_required },
    { key: 'phone', label: 'Phone number', enabled: settings.collect_phone, required: settings.phone_required },
    { key: 'email', label: 'Email', enabled: settings.collect_email, required: settings.email_required },
    { key: 'vehicle_registration', label: 'Vehicle registration', enabled: settings.collect_vehicle_registration, required: settings.vehicle_registration_required },
  ])
  const save = async () => {
    const payload: Record<string, boolean> = {}
    fields.forEach(({ key, enabled, required }) => {
      payload[`collect_${key}`] = enabled
      payload[`${key}_required`] = enabled && required
    })
    await update.mutateAsync(payload)
    showToast('Customer details settings saved.', 'success')
  }
  return <section>
    <SectionHeading title="Customer details when joining" info="Only ask for information this business needs. A required field is always enabled." />
    <div className="mt-3 divide-y divide-slate-100 rounded-lg bg-white shadow-card">
      {fields.map(({ key, label, enabled, required }, index) => <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <span className="font-medium text-slate-900">{label}</span><div className="flex gap-4">
          <label><input type="checkbox" checked={enabled} onChange={(e) => setFields((all) => all.map((f, i) => i === index ? { ...f, enabled: e.target.checked, required: e.target.checked && f.required } : f))} /> Enabled</label>
          <label className={!enabled ? 'text-slate-400' : ''}><input type="checkbox" disabled={!enabled} checked={required} onChange={(e) => setFields((all) => all.map((f, i) => i === index ? { ...f, required: e.target.checked } : f))} /> Required</label>
        </div></div>)}
    </div>
    <button type="button" onClick={() => void save()} disabled={update.isPending} className={`mt-4 ${saveClass}`}>{update.isPending ? 'Saving…' : 'Save customer details'}</button>
  </section>
}

function EstimatesForm({ settings }: { settings: QueueSettings }) {
  const garageId = useGarageId()
  const update = useUpdateQueueSettings()
  const { data: types = [] } = useAppointmentTypes('ACTIVE')
  const { showToast } = useToast()
  const [mode, setMode] = useState<AverageMode>(settings.average_mode)
  const [manual, setManual] = useState(
    settings.manual_average_minutes === null ? '' : String(settings.manual_average_minutes),
  )
  const [timeout, setTimeoutMinutes] = useState(
    settings.no_show_timeout_minutes === null ? '' : String(settings.no_show_timeout_minutes),
  )
  const [defaultType, setDefaultType] = useState(settings.default_appointment_type_id ?? '')
  const [error, setError] = useState<string | null>(null)

  const { average } = settings

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'MANUAL' && !manual) {
      setError('Enter how long a typical walk-in takes, or switch to automatic.')
      return
    }
    try {
      await update.mutateAsync({
        average_mode: mode,
        manual_average_minutes: manual === '' ? null : Number(manual),
        no_show_timeout_minutes: timeout === '' ? null : Number(timeout),
        default_appointment_type_id: defaultType || null,
      })
      showToast('Walk-in queue settings saved.', 'success')
    } catch (err) {
      setError(ownerError(err))
    }
  }

  return (
    <form onSubmit={submit}>
      <SectionHeading
        title="Wait estimates"
        info={
          <>
            Estimates count everyone ahead in the queue and today's booked appointments, across
            the customers you can serve at once. That number is shared with your booking
            calendar - change it under "Bookings per slot" in Availability.
          </>
        }
      />
      <p className="mt-1 text-sm text-slate-600">
        Serving {settings.capacity} {settings.capacity === 1 ? 'customer' : 'customers'} at once ·{' '}
        <Link to={`/${garageId}/settings/availability`} className="underline">
          Change in Availability
        </Link>
      </p>

      <fieldset className="mt-4 space-y-2 text-sm text-slate-700">
        <legend className="flex items-center gap-1 text-sm font-medium text-slate-700">
          How long a walk-in usually takes
          <InfoTip label="walk-in length">
            When a customer picks a service, that service's own length is used instead.
          </InfoTip>
        </legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="average_mode"
            checked={mode === 'AUTO'}
            onChange={() => setMode('AUTO')}
            className="mt-0.5"
          />
          <span>
            Work it out from recent jobs
            <span className="block text-xs text-slate-500">
              {average.auto_minutes !== null
                ? `Currently ${average.auto_minutes} min — the typical length of your last ${average.auto_sample_size} completed appointments.`
                : `Not enough history yet (${average.auto_sample_size} of 5 completed jobs) — using your default appointment length until there is.`}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="average_mode"
            checked={mode === 'MANUAL'}
            onChange={() => setMode('MANUAL')}
            className="mt-0.5"
          />
          <span>Set it myself</span>
        </label>
        {mode === 'MANUAL' && (
          <label className="ml-6 block max-w-xs">
            Minutes per walk-in
            <input
              type="number"
              min={5}
              max={480}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <p className="text-xs text-slate-600">
          Currently estimating {average.effective_minutes} min for anyone who hasn't picked a
          service.
        </p>
      </fieldset>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel
            htmlFor="queue-timeout"
            info="If they don't come forward in time they're marked a no-show and the next person is called. Leave blank to never skip automatically."
          >
            Skip a called customer after (minutes)
          </FieldLabel>
          <input
            id="queue-timeout"
            type="number"
            min={1}
            max={120}
            placeholder="Never"
            value={timeout}
            onChange={(e) => setTimeoutMinutes(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="queue-default-type"
            info="The service on a walk-in's appointment when they didn't choose one."
          >
            Record walk-ins as
          </FieldLabel>
          <select
            id="queue-default-type"
            value={defaultType}
            onChange={(e) => setDefaultType(e.target.value)}
            className={inputClass}
          >
            <option value="">Your first service</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={update.isPending} className={`mt-4 ${saveClass}`}>
        {update.isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

function describeWindow(w: ReservedWindow): string {
  const when = w.weekday !== null ? `Every ${WEEKDAYS[w.weekday]}` : formatLongDate(w.date ?? '')
  const bays = `${w.reserved_capacity} ${w.reserved_capacity === 1 ? 'place' : 'places'}`
  return `${when}, ${w.starts_at.slice(0, 5)}–${w.ends_at.slice(0, 5)} · ${bays}`
}

function ReservedWindowsSection({ capacity }: { capacity: number }) {
  const { data: windows = [] } = useReservedWindows()
  const add = useAddReservedWindow()
  const remove = useDeleteReservedWindow()
  const { showToast } = useToast()
  const [kind, setKind] = useState<'weekly' | 'date'>('weekly')
  const [weekday, setWeekday] = useState('0')
  const [date, setDate] = useState('')
  const [startsAt, setStartsAt] = useState('09:00')
  const [endsAt, setEndsAt] = useState('11:00')
  const [places, setPlaces] = useState('1')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (kind === 'date' && !date) {
      setError('Pick a date.')
      return
    }
    if (startsAt >= endsAt) {
      setError('The window must end after it starts.')
      return
    }
    try {
      await add.mutateAsync({
        weekday: kind === 'weekly' ? Number(weekday) : null,
        date: kind === 'date' ? date : null,
        starts_at: startsAt,
        ends_at: endsAt,
        reserved_capacity: Number(places),
        note: note || null,
      })
      setNote('')
      showToast('Walk-in time reserved.', 'success')
    } catch (err) {
      setError(ownerError(err))
    }
  }

  return (
    <div>
      <SectionHeading
        title="Time kept free for walk-ins"
        info={`During these windows, online booking only offers what's left after the places you keep back, so a busy booking day can't crowd out walk-ins. Reserving all ${capacity} makes the window walk-in only. Staff can still book into it by hand.`}
      />

      <ul className="mt-3 divide-y divide-slate-100 rounded-lg bg-white shadow-card">
        {windows.length === 0 && <li className="px-4 py-2.5 text-sm text-slate-500">No time reserved.</li>}
        {windows.map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <span>
              {describeWindow(w)}
              {w.note ? ` — ${w.note}` : ''}
            </span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await remove.mutateAsync(w.id)
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
          Repeats
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'weekly' | 'date')}
            className={inputClass}
          >
            <option value="weekly">Every week</option>
            <option value="date">One day only</option>
          </select>
        </label>
        {kind === 'weekly' ? (
          <label className="text-sm text-slate-700">
            Day
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)} className={inputClass}>
              {WEEKDAYS.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        ) : (
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
        )}
        <label className="text-sm text-slate-700">
          From
          <input
            type="time"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm text-slate-700">
          To
          <input
            type="time"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm text-slate-700">
          Places kept free
          <input
            type="number"
            min={1}
            max={100}
            value={places}
            onChange={(e) => setPlaces(e.target.value)}
            className={`${inputClass} w-24`}
          />
        </label>
        <label className="text-sm text-slate-700">
          Note (optional)
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </label>
        <button type="submit" disabled={add.isPending} className={saveClass}>
          Reserve time
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
