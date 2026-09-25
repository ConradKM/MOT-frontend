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
      <h1 className="text-2xl font-semibold text-slate-900">Walk-in Queue</h1>
      <p className="mt-1 text-sm text-slate-500">
        How walk-in waits are estimated, and time you keep free for walk-ins. Open and close the
        queue itself from the{' '}
        <Link to={`/${garageId}/queue`} className="underline">
          Queue
        </Link>{' '}
        page.
      </p>

      {isLoading || !data ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="mt-8 space-y-10">
          <EstimatesForm settings={data} />
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
      <h2 className="text-sm font-semibold text-slate-900">Wait estimates</h2>
      <p className="mt-1 text-xs text-slate-500">
        Estimates count everyone ahead in the queue <em>and</em> today's booked appointments,
        across the {settings.capacity} {settings.capacity === 1 ? 'customer' : 'customers'} you
        can serve at once. That number is shared with your booking calendar — change it under
        "Bookings per slot" in{' '}
        <Link to={`/${garageId}/settings/availability`} className="underline">
          Availability
        </Link>
        .
      </p>

      <fieldset className="mt-4 space-y-2 text-sm text-slate-700">
        <legend className="text-sm text-slate-700">How long a walk-in usually takes</legend>
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
        <p className="text-xs text-slate-500">
          When a customer picks a service, that service's own length is used instead. Currently
          estimating {average.effective_minutes} min for everyone else.
        </p>
      </fieldset>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-700">
          Skip a called customer after (minutes)
          <input
            type="number"
            min={1}
            max={120}
            placeholder="Never"
            value={timeout}
            onChange={(e) => setTimeoutMinutes(e.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-slate-500">
            If they don't come forward in time they're marked a no-show and the next person is
            called. Leave blank to never skip automatically.
          </span>
        </label>
        <label className="block text-sm text-slate-700">
          Record walk-ins as
          <select
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
          <span className="mt-1 block text-xs text-slate-500">
            The service on a walk-in's appointment when they didn't choose one.
          </span>
        </label>
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
      <h2 className="text-sm font-semibold text-slate-900">Time kept free for walk-ins</h2>
      <p className="mt-1 text-xs text-slate-500">
        During these windows, online booking only offers what's left after the places you keep
        back, so a busy booking day can't crowd out walk-ins. Reserving all {capacity} makes the
        window walk-in only. Staff can still book into it by hand.
      </p>

      <ul className="mt-3 space-y-1.5">
        {windows.length === 0 && <li className="text-sm text-slate-400">No time reserved.</li>}
        {windows.map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
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
