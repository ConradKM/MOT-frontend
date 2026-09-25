import { Link } from 'react-router-dom'
import {
  useCallNext,
  useQueueDashboard,
  useQueueEntryAction,
  useReorderQueue,
  useSetQueueOpen,
} from '../../api/queries'
import type { QueueDashboard as Dashboard, QueueEntry, QueueEntryAction } from '../../api/queue'
import { Disclosure } from '../../components/Disclosure'
import { useToast } from '../../components/Toast'
import { useGarageId } from '../../hooks/useGarageId'
import { formatTime } from '../../lib/datetime'
import { errorMessage } from '../../lib/errors'
import {
  QUEUE_STATUS_LABELS,
  buildTimeline,
  formatWait,
  minutesUntil,
  moveId,
} from '../../lib/queue'

const buttonClass =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40'
const primaryClass =
  'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'

const AVERAGE_SOURCE: Record<Dashboard['average']['source'], string> = {
  AUTO: 'from recent jobs',
  MANUAL: 'set manually',
  DEFAULT: 'default',
}

/**
 * Staff live walk-in queue. Polls every 15s (useQueueDashboard) - fine for a
 * front desk, and what keeps timeouts and ETAs current without sockets.
 */
export function QueueDashboard() {
  const garageId = useGarageId()
  const { data, isLoading, error } = useQueueDashboard()
  const setOpen = useSetQueueOpen()
  const callNext = useCallNext()
  const act = useQueueEntryAction()
  const reorder = useReorderQueue()
  const { showToast } = useToast()

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>
  if (error || !data) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {errorMessage(error)}
      </p>
    )
  }

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      showToast(errorMessage(err))
    }
  }
  const onAction = (id: string, action: QueueEntryAction) =>
    run(() => act.mutateAsync({ id, action }))

  const waiting = data.entries.filter((e) => e.status === 'WAITING')
  const called = data.entries.filter((e) => e.status === 'CALLED')
  const serving = data.entries.filter((e) => e.status === 'IN_SERVICE')
  const finished = data.entries.filter(
    (e) => e.status === 'DONE' || e.status === 'CANCELLED' || e.status === 'NO_SHOW',
  )
  const waitingIds = waiting.map((e) => e.id)
  const busy = act.isPending || reorder.isPending || callNext.isPending

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Walk-in queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.is_open ? (
              <span className="font-medium text-emerald-700">Open</span>
            ) : (
              <span className="font-medium text-slate-700">Closed</span>
            )}
            {' · '}
            {data.accepting_joins
              ? `A new walk-in would wait ${formatWait(
                  minutesUntil(data.new_joiner_estimated_start_at, data.now),
                )}`
              : (data.refusal_message ?? 'Not taking new walk-ins')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/${garageId}/settings/walk-in-queue`} className={buttonClass}>
            Queue settings
          </Link>
          <button
            type="button"
            className={buttonClass}
            disabled={setOpen.isPending}
            onClick={() => run(() => setOpen.mutateAsync(!data.is_open))}
          >
            {data.is_open ? 'Close queue' : 'Open queue'}
          </button>
          <button
            type="button"
            className={primaryClass}
            disabled={busy || waiting.length === 0}
            onClick={() => run(() => callNext.mutateAsync())}
          >
            Call next
          </button>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Waiting" value={String(waiting.length)} />
        <Stat label="Called" value={String(called.length)} />
        <Stat label="Being served" value={String(serving.length)} />
        <Stat
          label="Typical job"
          value={`${data.average.effective_minutes} min`}
          hint={`${AVERAGE_SOURCE[data.average.source]} · ${data.capacity} ${
            data.capacity === 1 ? 'bay' : 'bays'
          }`}
        />
      </dl>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-3">
          <Section title="Called forward" empty="Nobody is on their way up." count={called.length}>
            {called.map((e) => (
              <EntryRow key={e.id} entry={e}>
                <span className="text-xs text-slate-500">
                  Called {e.called_at ? formatTime(e.called_at) : ''}
                  {e.call_expires_at && ` · skip at ${formatTime(e.call_expires_at)}`}
                </span>
                <button className={buttonClass} disabled={busy} onClick={() => onAction(e.id, 'start')}>
                  Arrived — start
                </button>
                <button className={buttonClass} disabled={busy} onClick={() => onAction(e.id, 'no-show')}>
                  No-show
                </button>
              </EntryRow>
            ))}
          </Section>

          <Section title="Being served" empty="Nobody is being served." count={serving.length}>
            {serving.map((e) => (
              <EntryRow key={e.id} entry={e}>
                <span className="text-xs text-slate-500">
                  Started {e.started_at ? formatTime(e.started_at) : ''}
                </span>
                <button className={buttonClass} disabled={busy} onClick={() => onAction(e.id, 'complete')}>
                  Done
                </button>
              </EntryRow>
            ))}
          </Section>

          <Section title="Waiting" empty="Nobody is waiting." count={waiting.length}>
            {waiting.map((e, index) => (
              <EntryRow key={e.id} entry={e} position={e.position}>
                <span className="text-xs text-slate-500">
                  {e.fits_today === false
                    ? 'Past closing'
                    : `${formatWait(e.estimated_wait_minutes)}${
                        e.estimated_start_at && (e.estimated_wait_minutes ?? 0) > 0
                          ? ` · ~${formatTime(e.estimated_start_at)}`
                          : ''
                      }`}
                </span>
                <button
                  className={buttonClass}
                  disabled={busy || index === 0}
                  aria-label={`Move ticket ${e.ticket_number} up`}
                  onClick={() => run(() => reorder.mutateAsync(moveId(waitingIds, e.id, -1)))}
                >
                  ↑
                </button>
                <button
                  className={buttonClass}
                  disabled={busy || index === waiting.length - 1}
                  aria-label={`Move ticket ${e.ticket_number} down`}
                  onClick={() => run(() => reorder.mutateAsync(moveId(waitingIds, e.id, 1)))}
                >
                  ↓
                </button>
                <button className={buttonClass} disabled={busy} onClick={() => onAction(e.id, 'call')}>
                  Call
                </button>
                <button className={buttonClass} disabled={busy} onClick={() => onAction(e.id, 'start')}>
                  Start
                </button>
                <button className={buttonClass} disabled={busy} onClick={() => onAction(e.id, 'cancel')}>
                  Remove
                </button>
              </EntryRow>
            ))}
          </Section>

          {finished.length > 0 && (
            <Disclosure title={`Finished today (${finished.length})`}>
              <ul className="space-y-1 text-sm text-slate-600">
                {finished.map((e) => (
                  <li key={e.id}>
                    #{e.ticket_number} {e.customer_first_name} — {QUEUE_STATUS_LABELS[e.status]}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>

        <section className="lg:col-span-2" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="text-sm font-semibold text-slate-900">
            Today's timeline
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Booked appointments and walk-ins together
            {data.opens_at && data.closes_at
              ? ` · open ${formatTime(data.opens_at)}–${formatTime(data.closes_at)}`
              : ' · closed today'}
          </p>
          <ol className="mt-3 space-y-1.5">
            {buildTimeline(data).map((item) => (
              <li
                key={item.key}
                className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${
                  item.kind === 'walk-in'
                    ? 'border-sky-200 bg-sky-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <span className="w-14 shrink-0 tabular-nums text-slate-700">
                  {item.time ? `${item.estimated ? '~' : ''}${formatTime(item.time)}` : '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{item.title}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {item.kind === 'walk-in' ? 'Walk-in' : 'Booked'}
                    {item.detail ? ` · ${item.detail}` : ''}
                  </span>
                </span>
              </li>
            ))}
            {data.appointments.length === 0 && waiting.length + called.length === 0 && (
              <li className="text-sm text-slate-400">Nothing scheduled today.</li>
            )}
          </ol>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-900">{value}</dd>
      {hint && <dd className="text-xs text-slate-500">{hint}</dd>}
    </div>
  )
}

function Section({
  title,
  empty,
  count,
  children,
}: {
  title: string
  empty: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <h2 className="text-sm font-semibold text-slate-900">
        {title} <span className="font-normal text-slate-400">({count})</span>
      </h2>
      {count === 0 ? (
        <p className="mt-2 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">{children}</ul>
      )}
    </section>
  )
}

function EntryRow({
  entry,
  position,
  children,
}: {
  entry: QueueEntry
  position?: number | null
  children: React.ReactNode
}) {
  const name = [entry.customer_first_name, entry.customer_last_name].filter(Boolean).join(' ')
  return (
    <li
      className="rounded-lg border border-slate-200 bg-white p-3"
      aria-label={`Ticket ${entry.ticket_number}, ${name}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">
          {position ? <span className="mr-2 text-slate-400">{position}.</span> : null}#
          {entry.ticket_number} {name}
        </p>
        <p className="text-xs text-slate-500">
          {entry.appointment_type_name ?? 'Service not chosen'} · {entry.service_minutes} min
          {entry.vehicle_registration && ` · ${entry.vehicle_registration}`}
          {' · '}
          {entry.customer_phone}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>
    </li>
  )
}
