import { useMOTReminders, useGarage } from '../../api/queries'
import { MotBadge } from '../../components/MotBadge'
import { formatDateTime } from '../../lib/datetime'
import type { MOTReminderStatus } from '../../api/motReminders'

const STATUS_STYLE: Record<MOTReminderStatus, { label: string; cls: string }> = {
  scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
  sent: { label: 'Sent', cls: 'bg-emerald-100 text-emerald-700' },
  not_scheduled: { label: 'Not scheduled', cls: 'bg-slate-100 text-slate-500' },
}

export function MotRemindersList() {
  const { data: garage } = useGarage()
  const { data: rows, isLoading, isError } = useMOTReminders()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">MOT reminders</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upcoming MOT expiries for {garage?.name ?? 'your garage'} and the state of each
        reminder. Reminders are sent automatically — this page is for visibility.
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
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Registration</th>
                <th className="px-4 py-2 font-medium">MOT expiry</th>
                <th className="px-4 py-2 font-medium">Reminder</th>
                <th className="px-4 py-2 font-medium">Last sent</th>
                <th className="px-4 py-2 font-medium">Next scheduled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = STATUS_STYLE[r.reminder_status]
                return (
                  <tr key={r.vehicle_id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-slate-700">{r.customer_name}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {[r.make, r.model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {r.registration_number}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <span className="mr-2">{r.mot_expiry_date}</span>
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
                      {r.next_reminder_scheduled
                        ? formatDateTime(r.next_reminder_scheduled)
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
