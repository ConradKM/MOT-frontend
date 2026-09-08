import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMOTReminders, useGarage, useSendManualReminder } from '../../api/queries'
import { MotBadge } from '../../components/MotBadge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { useGarageId } from '../../hooks/useGarageId'
import { formatDateShort, formatDateTime } from '../../lib/datetime'
import { errorMessage, isApiError } from '../../lib/errors'
import type {
  MOTReminderRow,
  MOTReminderStatus,
  ReminderHistoryEntry,
  ReminderStageRow,
} from '../../api/motReminders'

const STATUS_STYLE: Record<MOTReminderStatus, { label: string; cls: string }> = {
  booked: { label: 'MOT booked', cls: 'bg-indigo-100 text-indigo-700' },
  scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
  sent: { label: 'Sent', cls: 'bg-emerald-100 text-emerald-700' },
  expired: { label: 'Expired', cls: 'bg-amber-100 text-amber-700' },
  not_scheduled: { label: 'Not scheduled', cls: 'bg-slate-100 text-slate-500' },
}

const STAGE_LABEL: Record<string, string> = {
  STAGE_1: 'First reminder',
  STAGE_2: 'Second reminder',
  STAGE_3: 'Final reminder',
  MANUAL: 'Manual reminder',
}

function stageStateText(s: ReminderStageRow): string {
  switch (s.state) {
    case 'sent':
      return s.sent_at ? `Sent ${formatDateShort(s.sent_at)}` : 'Sent'
    case 'scheduled':
      return s.scheduled_for ? `Scheduled ${formatDateShort(s.scheduled_for)}` : 'Scheduled'
    case 'suppressed':
      return 'Paused — MOT booked'
    case 'disabled':
      return 'Off'
    case 'expired':
      return 'Not sent — MOT expired'
    default:
      return s.state
  }
}

function historyLine(h: ReminderHistoryEntry): string {
  const label = h.stage ? (STAGE_LABEL[h.stage] ?? h.stage) : 'Reminder'
  const when = h.sent_at
    ? `sent ${formatDateTime(h.sent_at)}`
    : `scheduled ${formatDateTime(h.scheduled_at)}`
  const by = h.initiated_by ? ` by ${h.initiated_by}` : ''
  const outcome = h.status === 'SENT' ? '' : ` (${h.status.toLowerCase()})`
  return `${label} — ${when}${by}${outcome}`
}

export function MotRemindersList() {
  const { data: garage } = useGarage()
  const garageId = useGarageId()
  const { data: rows, isLoading, isError } = useMOTReminders()
  const sendReminder = useSendManualReminder()
  const { showToast } = useToast()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<MOTReminderRow | null>(null)

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const confirmSend = async () => {
    if (!pending) return
    try {
      await sendReminder.mutateAsync({
        vehicleId: pending.vehicle_id,
        acknowledgeBooking: pending.booking_active,
      })
      showToast(`Reminder sent to ${pending.customer_name}.`, 'success')
    } catch (err) {
      if (isApiError(err) && err.code === 409) {
        showToast('This vehicle now has an MOT booking — reminder not sent.')
      } else {
        showToast(errorMessage(err))
      }
    } finally {
      setPending(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">MOT reminders</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upcoming MOT expiries for {garage?.name ?? 'your business'} and the state of each
        reminder. Automatic reminders follow your{' '}
        <Link
          to={`/${garageId}/settings/mot-reminders`}
          className="font-medium text-slate-700 underline hover:text-slate-900"
        >
          reminder schedule
        </Link>{' '}
        and stop when a vehicle has an active MOT booking.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {isLoading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
        {isError && <p className="p-4 text-sm text-red-600">Failed to load MOT reminders.</p>}
        {!isLoading && !isError && (rows?.length ?? 0) === 0 && (
          <p className="p-4 text-sm text-slate-500">No vehicles with a recorded MOT expiry.</p>
        )}
        {rows && rows.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Registration</th>
                <th className="px-4 py-2 font-medium">MOT expiry</th>
                <th className="px-4 py-2 font-medium">Reminder</th>
                <th className="px-4 py-2 font-medium">Last sent</th>
                <th className="px-4 py-2 font-medium">Next scheduled</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = STATUS_STYLE[r.reminder_status] ?? STATUS_STYLE.not_scheduled
                const isOpen = expanded.has(r.vehicle_id)
                return (
                  <Fragment key={r.vehicle_id}>
                    <tr className="border-b border-slate-100 last:border-0">
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          aria-label={isOpen ? 'Hide reminder history' : 'Show reminder history'}
                          aria-expanded={isOpen}
                          onClick={() => toggle(r.vehicle_id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <svg
                            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                            viewBox="0 0 20 20"
                            fill="none"
                          >
                            <path
                              d="M7 5l6 5-6 5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-2 text-slate-700">{r.customer_name}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {[r.make, r.model].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-900">
                        {r.registration_number}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        <span className="mr-2">{formatDateShort(r.mot_expiry_date)}</span>
                        <MotBadge motExpiryDate={r.mot_expiry_date} />
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {r.last_reminder_sent ? formatDateTime(r.last_reminder_sent) : '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {r.next_reminder_scheduled ? (
                          formatDateShort(r.next_reminder_scheduled)
                        ) : r.booking_active ? (
                          <span className="text-slate-400">MOT booked</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <RowAction row={r} onSend={() => setPending(r)} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td />
                        <td colSpan={8} className="px-4 py-3">
                          <ReminderDetail row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Send MOT reminder"
        confirmLabel="Send reminder"
        busy={sendReminder.isPending}
        onCancel={() => setPending(null)}
        onConfirm={confirmSend}
      >
        {pending && (
          <>
            <p>
              Send another MOT reminder to <strong>{pending.customer_name}</strong> for{' '}
              {[pending.make, pending.model].filter(Boolean).join(' ') || 'their vehicle'} (
              {pending.registration_number})?
            </p>
            {pending.customer_email ? (
              <p className="mt-1 text-xs text-slate-500">Emails {pending.customer_email}.</p>
            ) : (
              <p className="mt-1 text-xs text-amber-700">
                No email address on file — nothing will be delivered.
              </p>
            )}
            {pending.booking_active && (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                This vehicle already has an MOT booking. Only send a reminder if you have a
                specific reason to.
              </p>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}

function RowAction({ row, onSend }: { row: MOTReminderRow; onSend: () => void }) {
  if (!row.can_send_manual) return <span className="text-slate-400">—</span>

  if (row.booking_active) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
          MOT booked
        </span>
        <button
          type="button"
          onClick={onSend}
          className="text-xs font-medium text-slate-500 underline hover:text-slate-800"
        >
          Send anyway
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onSend}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      Send reminder
    </button>
  )
}

function ReminderDetail({ row }: { row: MOTReminderRow }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-400">Reminder schedule</p>
        <ul className="mt-1 space-y-1">
          {row.stages.map((s) => (
            <li key={s.stage} className="text-sm text-slate-600">
              <span className="text-slate-800">
                {STAGE_LABEL[s.stage]} — {s.days_before} {s.days_before === 1 ? 'day' : 'days'}{' '}
                before
              </span>
              {': '}
              <span className={s.state === 'disabled' ? 'text-slate-400' : 'text-slate-600'}>
                {stageStateText(s)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-slate-400">History</p>
        {row.history.length === 0 ? (
          <p className="mt-1 text-sm text-slate-400">No reminders sent yet.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {row.history.map((h, i) => (
              <li key={i} className="text-sm text-slate-600">
                {h.trigger === 'MANUAL' && (
                  <span className="mr-1 rounded bg-slate-200 px-1 text-[10px] font-semibold uppercase text-slate-600">
                    Manual
                  </span>
                )}
                {historyLine(h)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
